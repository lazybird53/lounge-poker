import {randomInt, randomUUID} from 'node:crypto';
import {botAction} from './bot.mjs';
export const actions=['오리','투표','감시','거래','창고'];
export const colors=['코랄','민트','라벤더','골드','블루','로즈'];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){let j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const fail=m=>{throw Error(m);};
export const CONNECTION_WARNING_MS=30000,DISCONNECT_GRACE_MS=180000;
export function player(name,bot=false){return {id:randomUUID(),token:randomUUID(),name:String(name||'손님').trim().slice(0,16)||'손님',bot,lastSeen:Date.now()};}
export function room(host){return {players:[host],host:host.id,phase:'lobby',round:0,log:[],chat:[],updated:Date.now()};}
function log(r,text){r.log.push(text);r.log=r.log.slice(-40);}
function lobby(r,message){
 Object.assign(r,{phase:'lobby',gameId:null,round:0,duck:null,fake:null,stock:[],pendingVote:null,until:null,result:null,voteResult:null,choices:{},choiceOrder:[],watches:{},votes:{},queue:[],task:null,log:[],notice:message});
 r.players.forEach((p,i)=>{p.color=i;p.hand=[];});
 log(r,message);
}
export function leave(r,p,disconnected=false){
 if(!r.players.includes(p))fail('이미 방을 나갔어요.');
 const interrupted=!['lobby','ended'].includes(r.phase);
 r.players=r.players.filter(q=>q!==p);
 if(r.host===p.id)r.host=r.players.find(q=>!q.bot)?.id||null;
 lobby(r,`${p.name}${disconnected?'의 연결이 3분 동안 돌아오지 않아 퇴장 처리했어요.':'님이 방을 나갔어요.'}${interrupted?' 진행 중인 판을 중단하고 대기실로 돌아왔어요.':''}`);
}
export function expireDisconnected(r,now=Date.now()){
 for(const p of [...r.players])if(!p.bot&&now-p.lastSeen>=DISCONNECT_GRACE_MS)leave(r,p,true);
}
export function start(r){
 if(r.players.length<4||r.players.length>6)fail('4~6명이 필요해요.');
 if(r.players.some(p=>!p.bot&&Date.now()-p.lastSeen>=CONNECTION_WARNING_MS))fail('연결이 끊긴 참가자가 돌아온 뒤 시작해 주세요.');
 r.notice='';
 r.gameId=randomUUID();
 const n=r.players.length;r.duck=randomInt(n);r.fake=shuffle([...Array(n).keys()].filter(i=>i!==r.duck))[0];
 // Original build 24783249: 4/5p overlap the last hand slot with the first stock slot.
 const handSize=n-1;
 let deck=shuffle([...Array(n).keys()].flatMap(i=>Array(handSize).fill(i)).concat(Array(handSize).fill('blank'),Array(Math.max(1,n-4)).fill('wild')));
 r.players.forEach((p,i)=>{p.color=i;p.hand=deck.slice(i*handSize,(i+1)*handSize);});
 r.stock=deck.slice(deck.length-n-1);r.pendingVote=null;r.until=null;r.log=[];r.result=null;r.voteResult=null;r.round=0;nextRound(r);
}
function nextRound(r){r.round++;r.phase='choose';r.choices={};r.choiceOrder=[];r.watches={};r.votes={};r.queue=[];r.task=null;log(r,`${r.round}번째 라운드 · 행동을 선택하세요.`);}
function end(r,winner,reason){r.phase='ended';r.task=null;r.result={winner,reason,duck:r.players[r.duck].id};log(r,reason);}
function finishVote(r){
 const result=r.pendingVote;r.pendingVote=null;r.voteResult=null;
 if(result)end(r,result.winner,result.reason);
 else {log(r,'기준 미달 · 나머지 행동을 진행해요.');advance(r);}
}
function advance(r){
 const previousPhase=r.phase;
 r.task=r.queue.shift()||null;
 // Original message 9 calls SetState(ChooseActions, delay=3.0f).
 if(!r.task){r.reviewFrom=previousPhase;r.phase='review';r.until=Date.now()+3000;log(r,'다음 라운드로 전환합니다.');return;}
 r.phase=r.task.kind;
 if(r.phase==='stock')r.task.displayOrder=shuffle(r.stock.map((_,i)=>i));
}
function resolveChoices(r){
 // Original build 24783249: same-action turns use the order in which submissions are processed.
 const group=a=>r.choiceOrder.filter(id=>r.choices[id]===a);
 if(group(0).length){end(r,'오리','오리 버튼이 선택되어 오리가 승리했어요.');return;}
 let voters=group(1);r.queue=[];
 if(voters.length>=2)r.queue.push({kind:'vote'});else if(voters.length===1)r.queue.push({kind:'special',actor:voters[0]});
 for(let a=2;a<5;a++)for(let id of group(a))r.queue.push({kind:['','','watch','trade','stock'][a],actor:id});
 advance(r);
}
export function tick(r,now=Date.now(),runBots=true){
 if(r.until&&now>=r.until){r.until=null;if(r.phase==='review')nextRound(r);else if(r.phase==='voteReview')finishVote(r);else if(r.phase==='reveal')advance(r);}
 if(runBots)bots(r);
}
export const allowed=p=>{let own=p.hand.map((v,i)=>v===p.color?i:-1).filter(i=>i>=0);return own.length?own:p.hand.map((_,i)=>i);};
function card(p,i,forced=false){if(!Number.isInteger(i)||i<0||i>=p.hand.length||(forced&&!allowed(p).includes(i)))fail('낼 수 있는 카드를 선택하세요. 자기 색 카드를 먼저 내야 해요.');}
function target(r,p,id){let q=r.players.find(x=>x.id===id&&x.id!==p.id);if(!q)fail('다른 플레이어를 선택하세요.');return q;}
export function act(r,p,b){
 if(b.gameId!==undefined&&(b.gameId!==r.gameId||b.round!==r.round))fail('이전 판의 입력이에요. 현재 화면에서 다시 선택해 주세요.');
 if(b.type==='lobby'){if(p.id!==r.host)fail('방장만 대기실로 돌아갈 수 있어요.');lobby(r,'방장이 대기실로 돌아왔어요. 인원을 변경하고 새 판을 시작할 수 있어요.');return;}
 if(b.type==='removeBot'){if(p.id!==r.host||r.phase!=='lobby')fail('대기실에서 방장만 봇을 뺄 수 있어요.');const bot=r.players.findLast(q=>q.bot);if(!bot)fail('제거할 봇이 없어요.');leave(r,bot);return;}
 if(b.type==='chat'){
  if(typeof b.text!=='string'||!b.text.trim()||b.text.length>240)fail('채팅은 1~240자로 입력해 주세요.');
  if(p.lastChat&&Date.now()-p.lastChat<500)fail('잠시 후 다시 보내 주세요.');
  p.lastChat=Date.now();r.chat.push({name:p.name,text:b.text.trim()});r.chat=r.chat.slice(-60);return;
 }
 if(b.type==='start'){if(p.id!==r.host||!['lobby','ended'].includes(r.phase))fail('방장만 시작할 수 있어요.');start(r);return;}
 if(b.type==='bot'){if(p.id!==r.host||r.phase!=='lobby'||r.players.length>=6)fail('대기실에서 방장만 봇을 추가할 수 있어요.');r.players.push(player(`연습 봇 ${r.players.length}`,true));return;}
 if(r.phase==='choose'){
  if(b.type!=='choose'||!Number.isInteger(b.action)||b.action<0||b.action>4||r.choices[p.id]!==undefined)fail('행동은 한 번만 선택할 수 있어요.');
  r.choices[p.id]=b.action;r.choiceOrder.push(p.id);if(Object.keys(r.choices).length===r.players.length)resolveChoices(r);return;
 }
 if(r.phase==='vote'){
  if(b.type!=='card'||r.votes[p.id]!==undefined)fail('이미 투표했어요.');card(p,b.index);r.votes[p.id]=p.hand[b.index];
  if(Object.keys(r.votes).length===r.players.length){
   r.voteResult={...r.votes};const values=Object.values(r.votes);const counts=r.players.map((q,i)=>values.filter(v=>v===i||v==='wild').length);const max=Math.max(...counts);const winner=max>=r.players.length-1?counts.indexOf(max):-1;
   log(r,'투표 카드가 공개되었어요.');
   r.pendingVote=winner>=0?{winner:winner===r.duck?'거위':'오리',reason:`${colors[winner]}에게 ${counts[winner]}표가 모였어요.`}:null;
   r.phase='voteReview';r.until=Date.now()+5000;
  }return;
 }
 const t=r.task;if(!t)fail('현재 실행할 행동이 없어요.');
 if(r.phase==='watch'){
  if(b.type!=='target'||r.choices[p.id]!==2||r.watches[p.id])fail('감시 대상을 선택할 수 없어요.');
  const q=target(r,p,b.target);
  r.watches[p.id]=q.id;log(r,`${p.name} 감시 준비 완료`);
  if(t.actor===p.id)advance(r);
  else r.queue=r.queue.filter(item=>!(item.kind==='watch'&&item.actor===p.id));
  return;
 }
 if(r.phase==='trade'&&t.target){
  if(p.id===t.target&&t.offers?.[t.actor]===undefined)fail('거래 요청자가 카드를 먼저 선택해야 해요.');
  if(b.type!=='card'||![t.actor,t.target].includes(p.id)||t.offers?.[p.id]!==undefined)fail('거래 참여자의 카드 선택을 기다리고 있어요.');card(p,b.index,true);t.offers??={};t.offers[p.id]=b.index;
  if(p.id===t.actor){const q=r.players.find(x=>x.id===t.target),own=q.hand.findIndex(v=>v===q.color);if(own>=0)t.offers[q.id]=own;}
  if(Object.keys(t.offers).length===2){let a=r.players.find(x=>x.id===t.actor),q=r.players.find(x=>x.id===t.target);let i=t.offers[a.id],j=t.offers[q.id];[a.hand[i],q.hand[j]]=[q.hand[j],a.hand[i]];log(r,`${a.name} ↔ ${q.name} 거래 완료`);advance(r);}return;
 }
 if(t.actor!==p.id)fail('다른 플레이어의 행동을 기다리고 있어요.');
 if(b.type==='target'&&['trade','special'].includes(r.phase)&&!t.target){t.target=target(r,p,b.target).id;return;}
 if(['stock','special'].includes(r.phase)&&b.type==='take'&&t.take===undefined){
  const hand=r.phase==='stock'?r.stock:target(r,p,t.target).hand;
  card({hand},b.index);t.take=r.phase==='stock'?t.displayOrder[b.index]:b.index;return;
 }
 if(r.phase==='stock'&&b.type==='card'&&t.take!==undefined){card(p,b.index,true);[p.hand[b.index],r.stock[t.take]]=[r.stock[t.take],p.hand[b.index]];log(r,`${p.name} 창고 교환 완료`);advance(r);return;}
 if(r.phase==='special'&&t.target&&b.type==='card'&&t.take!==undefined){let q=target(r,p,t.target);card(p,b.index,true);[p.hand[b.index],q.hand[t.take]]=[q.hand[t.take],p.hand[b.index]];log(r,`${p.name} 특수 교환 완료`);advance(r);return;}
 fail('현재 단계에 맞는 행동을 선택하세요.');
}
// CardGame.FixedUpdate / WaitingState: public submission status, not card contents.
function waitingState(r,p){
 if(r.phase==='review'){
  const kind={special:1,watch:2,trade:3}[r.reviewFrom];
  return kind!==undefined&&r.choices[p.id]===kind?'complete':'none';
 }
 if(r.phase==='choose')return r.choices[p.id]===undefined?'waiting':'complete';
 if(['vote','voteReview'].includes(r.phase))return r.votes[p.id]===undefined?'waiting':'complete';
 const kind={special:1,watch:2,trade:3,stock:4}[r.phase],t=r.task;
 if(kind===undefined)return 'none';
 // A trade recipient can be responding even while their own action is queued/done.
 if(r.phase==='trade'&&t?.target===p.id&&t.offers?.[t.actor]!==undefined)return 'waiting';
 if(r.choices[p.id]!==kind)return 'none';
 if(r.phase==='watch')return r.watches[p.id]?'complete':'waiting';
 if(t?.actor===p.id)return r.phase==='trade'&&t.offers?.[p.id]!==undefined?'complete':'waiting';
 return r.queue.some(a=>a.actor===p.id)?'queued':'complete';
}
export function view(r,p){
 const active=!['lobby','ended'].includes(r.phase);const candidate=r.players[p.color===r.duck?r.fake:r.duck]?.id;
 let t=r.task;let visible=r.watches?.[p.id];if(t?.kind==='special'&&t.actor===p.id)visible=t.take===undefined?t.target:null;
 if(r.phase==='watch')t=r.choices[p.id]===2&&!r.watches[p.id]?{kind:'watch',actor:p.id}:null;
 if(t?.kind==='trade'&&t.offers?.[t.actor]===undefined&&p.id!==t.actor)t={kind:'trade',actor:t.actor};
 const q=r.players.find(x=>x.id===visible);
 return {code:r.code,gameId:r.gameId,notice:r.notice||'',host:r.host,me:p.id,phase:r.phase,round:r.round,candidate:active?candidate:null,hand:p.hand||[],allowed:p.hand?allowed(p):[],players:r.players.map((x,i)=>({id:x.id,name:x.name,color:i,bot:x.bot,connected:x.bot||Date.now()-x.lastSeen<CONNECTION_WARNING_MS,completed:waitingState(r,x)==='complete',thinking:waitingState(r,x)==='waiting',queued:waitingState(r,x)==='queued',ready:r.choices?.[x.id]!==undefined,action:r.phase==='choose'?null:r.choices?.[x.id]})),chosen:r.choices?.[p.id]??null,stockCount:t?.kind==='stock'&&t.actor===p.id&&t.take===undefined?r.stock.length:null,task:t?{kind:t.kind,actor:t.actor,target:t.kind==='special'&&t.actor!==p.id?undefined:t.target,stage:t.actor===p.id&&['stock','special'].includes(t.kind)?(t.kind==='special'&&!t.target?'target':t.take===undefined?'receive':'give'):null,submitted:!!t.offers&&t.offers[p.id]!==undefined}:null,voted:r.votes?.[p.id]!==undefined,visible:q?{id:q.id,name:q.name,hand:q.hand}:null,voteResult:r.voteResult,result:r.result,log:r.log,chat:r.chat};
}
export function bots(r){
 const pick=a=>a[randomInt(a.length)];
 // Shuffle who gets to respond first, not the engine's submitted-action order.
 for(const p of shuffle(r.players.filter(x=>x.bot))){
  const b=botAction(view(r,p),pick);if(b){act(r,p,b);return;}
 }
}
