import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {orderedCards} from './public/card-display.mjs';
import {gooseArt,actionArt} from './public/table-art.mjs';

const source=await readFile(new URL('./public/app.js',import.meta.url),'utf8');
function harness(saved=null){
 const nodes=new Map(),pending=[],scrolls=[];
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{value:'',style:{},dataset:{},focus(){},setSelectionRange(){}});
  return nodes.get(selector);
 };
 const context=vm.createContext({
  orderedCards,gooseArt,actionArt,AbortSignal,createVoice:()=>({sync(){},stop(){}}),confirm:()=>true,
  document:{querySelector:node,querySelectorAll:()=>[],activeElement:{}},
  sessionStorage:{getItem:key=>key==='lounge'?saved:null,setItem(){},removeItem(){}},
  window:{scrollTo(...args){scrolls.push(args);}},navigator:{},setInterval(){},setTimeout(){},clearTimeout(){},
  fetch:()=>new Promise(resolve=>pending.push(data=>resolve({ok:true,json:async()=>data}))),
 });
 vm.runInContext(source.replace(/^import .*\n/gm,'')+'\nglobalThis.client={send,sendChat,refresh,leaveRoom,get state(){return state},setAuth(value){auth=value}};',context);
 context.client.setAuth({code:'ABCDEF',token:'test'});
 return {client:context.client,pending,scrolls,setChat(text){node('#chatInput').value=text;},get html(){return node('#app').innerHTML}};
}
test('손상되거나 오래된 저장 세션도 빈 화면 대신 참가 화면으로 복구한다',()=>{
 for(const saved of ['{','[]','{"code":"ABCDEF"}','{"code":12,"token":"test"}']){
  const h=harness(saved);assert.match(h.html,/새로운 테이블 만들기/);assert.equal(h.pending.length,0);
 }
});
test('이전 방의 늦은 채팅 응답이 새 방의 전송 잠금을 풀지 않는다',async()=>{
 const h=harness();h.setChat('이전 방 메시지');const old=h.client.sendChat();
 h.client.setAuth({code:'FEDCBA',token:'new'});h.setChat('새 방 메시지');const current=h.client.sendChat();
 assert.equal(h.pending.length,2);h.pending[0]({});await old;
 h.setChat('다음 메시지');await h.client.sendChat();assert.equal(h.pending.length,2);
 h.pending[1]({});await current;
 const next=h.client.sendChat();assert.equal(h.pending.length,3);h.pending[2]({});await next;
});
const snapshot=phase=>({phase,players:[],chat:[],log:[],hand:[],allowed:[],round:1,chosen:null});
test('종료 때만 확정된 승리 참가자를 표시하고 재시작 시 제거한다',async()=>{
 const h=harness(),players=[{id:'a',name:'거위 A',color:0},{id:'b',name:'오리 B',color:1}];
 for(const [winner,name,absent] of [['오리','오리 B','거위 A'],['거위','거위 A','오리 B']]){
  const poll=h.client.refresh();h.pending.shift()({...snapshot('ended'),players,result:{winner,duck:'b',reason:'판정'}});await poll;
  const lineup=h.html.match(/<div class="winner-lineup"[\s\S]*?<\/div>/)[0];
  assert.ok(lineup.includes(name));assert.ok(!lineup.includes(absent));
 }
 const poll=h.client.refresh();h.pending.shift()({...snapshot('choose'),players});await poll;
 assert.doesNotMatch(h.html,/winner-lineup|실제 오리:/);
});

test('표시 정렬은 원본 손패와 클릭 인덱스를 보존한다',()=>{
 const hand=[3,'wild',1,'blank',1],copy=[...hand];
 const displayed=orderedCards(hand);
 assert.deepEqual(displayed.map(c=>c.value),['blank','wild',1,1,3]);
 assert.deepEqual(hand,copy);
 for(const entry of displayed)assert.equal(hand[entry.index],entry.value);
 assert.deepEqual(displayed.filter(c=>c.value===1).map(c=>c.index),[2,4]);
});

test('늦게 도착한 상태 조회가 카드 제출 후 최신 단계를 덮지 않음',async()=>{
 const {client,pending}=harness();
 const poll=client.refresh();
 const submit=client.send({type:'card',index:0});
 pending[1](snapshot('review'));await submit;
 assert.equal(client.state.phase,'review');
 pending[0](snapshot('vote'));await poll;
 assert.equal(client.state.phase,'review');
});

test('처리 중인 상태 조회와 동일한 조회를 중복 발송하지 않음',async()=>{
 const {client,pending}=harness();
 const first=client.refresh(),second=client.refresh();
 assert.equal(pending.length,1);
 pending[0](snapshot('choose'));
 await Promise.all([first,second]);
 assert.equal(client.state.phase,'choose');
});

test('인증이 바뀐 후 이전 방 조회 응답을 반영하지 않음',async()=>{
 const {client,pending}=harness();
 const poll=client.refresh();
 client.setAuth({code:'OTHER',token:'other'});
 pending[0](snapshot('vote'));await poll;
 assert.equal(client.state,null);
});
test('방 나가기 뒤 늦은 조회 응답은 예전 방 화면을 복원하지 않음',async()=>{
 const h=harness(),poll=h.client.refresh(),leave=h.client.leaveRoom();
 h.pending[1]({left:true});await leave;
 assert.match(h.html,/새로운 테이블 만들기/);
 h.pending[0](snapshot('choose'));await poll;
 assert.equal(h.client.state,null);assert.match(h.html,/새로운 테이블 만들기/);
});

test('게임 시작 응답 뒤 모바일 화면을 맨 위로 복원함',async()=>{
 const {client,pending,scrolls}=harness();
 const start=client.send({type:'start'});
 pending[0](snapshot('choose'));await start;
 assert.deepEqual(scrolls,[[0,0]]);
});

test('도움말과 주요 상태 변화가 보조기기에 전달됨',()=>{
 assert.match(source,/setAttribute\?\.\('aria-labelledby','helpTitle'\)/);
 assert.match(source,/setAttribute\?\.\('aria-live','polite'\)/);
 assert.match(source,/setAttribute\?\.\('role','status'\)/);
 assert.match(source,/setAttribute\?\.\('role','alert'\)/);
});

test('대상은 초상으로 선택하고 감시/특수교환은 중앙 패널에서 권한을 구분한다',async()=>{
 const h=harness();
 const base={...snapshot('special'),me:'a',host:'a',code:'ABCDEF',players:[{id:'a',name:'나',color:0},{id:'b',name:'상대',color:1}],hand:[0,1,'blank'],allowed:[0],task:{actor:'a',kind:'special',stage:'target'}};
 let poll=h.client.refresh();h.pending.shift()(base);await poll;
 assert.match(h.html,/<button class="seat [^"]*" data-target="b"/);
 assert.doesNotMatch(h.html,/data-target="a"/);
 poll=h.client.refresh();h.pending.shift()({...base,task:{...base.task,target:'b',stage:'receive'},visible:{id:'b',name:'상대',hand:[1,0,'blank']}});await poll;
 assert.match(h.html,/class="stage-panel visible"/);
 assert.match(h.html,/class="table-center" hidden/);
 assert.match(h.html,/data-take="2"/);
 assert.doesNotMatch(h.html,/data-card=/);
 poll=h.client.refresh();h.pending.shift()({...base,phase:'trade',task:{actor:'b',kind:'trade'},visible:{id:'b',name:'상대',hand:[1,0,'blank']}});await poll;
 assert.match(h.html,/stage-panel visible surveillance/);
 assert.doesNotMatch(h.html,/data-take=|data-card=|data-say=/);
});

test('선택 중인 초상에만 말풍선을 표시하고 완료 시 제거한다',async()=>{
 const h=harness(),base={...snapshot('trade'),players:[{id:'a',name:'나',color:0,thinking:true},{id:'b',name:'상대',color:1,thinking:false}]};
 let poll=h.client.refresh();h.pending.shift()(base);await poll;
 assert.equal((h.html.match(/class="turn-bubble"/g)||[]).length,1);
 assert.match(h.html,/aria-label="선택 중"/);
 poll=h.client.refresh();h.pending.shift()({...base,players:base.players.map(p=>({...p,thinking:false,queued:p.id==='b'}))});await poll;
 assert.match(h.html,/aria-label="차례 대기" title="차례 대기"><\/span>/);
 assert.doesNotMatch(h.html,/<i><\/i>/);
 poll=h.client.refresh();h.pending.shift()({...base,players:base.players.map(p=>({...p,thinking:false,completed:true}))});await poll;
 assert.doesNotMatch(h.html,/class="turn-bubble"/);
});
test('거래 안내는 실제 자기색 보유와 거래 상대를 반영한다',async()=>{
 const h=harness(),base={...snapshot('trade'),me:'a',players:[{id:'a',name:'나',color:0},{id:'b',name:'상대',color:1}],task:{actor:'a',target:'b',kind:'trade',submitted:false},hand:[0,1,'blank'],allowed:[0]};
 let poll=h.client.refresh();h.pending.shift()(base);await poll;
 assert.match(h.html,/내 색 카드를 선택하세요/);assert.match(h.html,/상대와 거래 · 내 손패에서 한 장/);
 poll=h.client.refresh();h.pending.shift()({...base,hand:[1,1,'blank'],allowed:[0,1,2]});await poll;
 assert.match(h.html,/줄 카드를 선택하세요/);assert.doesNotMatch(h.html,/내 색 카드를 선택하세요/);
 poll=h.client.refresh();h.pending.shift()({...base,task:{...base.task,submitted:true}});await poll;
 assert.match(h.html,/상대의 응답을 기다려요/);assert.doesNotMatch(h.html,/data-card=/);
});

test('전원 제출 뒤에만 각 초상에 투표를 표시하고 안전 판정을 안내한다',async()=>{
 const h=harness(),base={...snapshot('vote'),me:'a',players:['a','b','c','d'].map((id,color)=>({id,color,name:id})),hand:[0,'blank','wild'],allowed:[0,1,2],voted:true};
 let poll=h.client.refresh();h.pending.shift()(base);await poll;assert.doesNotMatch(h.html,/class="vote-card"/);
 poll=h.client.refresh();h.pending.shift()({...base,phase:'voteReview',voteResult:{a:0,b:1,c:2,d:'blank'}});await poll;
 assert.equal((h.html.match(/class="vote-card"/g)||[]).length,4);
 assert.match(h.html,/모두 안전합니다/);assert.match(h.html,/a의 공개 투표/);
 assert.doesNotMatch(h.html,/실제 오리:/);
});
