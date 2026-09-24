import test from 'node:test';
import assert from 'node:assert/strict';
import {room,player,start,act,view,allowed,tick,leave,expireDisconnected,DISCONNECT_GRACE_MS,CONNECTION_WARNING_MS} from './engine.mjs';

const inventory=r=>JSON.stringify([...r.stock,...r.players.flatMap(p=>p.hand)].sort());
test('행동 전원 제출 즉시 처리하며 빠른 타이머 검사는 봇 입력을 실행하지 않는다',()=>{
 const r=setup(4);
 r.players.forEach(p=>act(r,p,{type:'choose',action:4}));
 assert.equal(r.phase,'stock');assert.equal(r.until,null);
 const task=JSON.stringify(r.task);r.players[0].bot=true;
 tick(r,Date.now(),false);assert.equal(JSON.stringify(r.task),task);
});
test('라운드 전환 중 마지막 감시/거래 체크 유지, 창고와 다음 라운드에서는 제거',()=>{
 const r=setup(4),p=r.players[0];
 for(const [phase,action,shown] of [['watch',2,true],['trade',3,true],['stock',4,false]]){
  r.phase='review';r.reviewFrom=phase;r.choices={[p.id]:action};
  assert.equal(view(r,p).players[0].completed,shown);
 }
 r.until=1;tick(r,2,false);assert.equal(view(r,p).players[0].completed,false);
});
test('원작 다음 라운드 3초 지연을 유지하고 추가 손패 확인 시간을 넣지 않는다',()=>{
 const r=setup(4);
 r.players.forEach(p=>act(r,p,{type:'choose',action:2}));tick(r,Infinity);
 const before=Date.now();
 r.players.forEach((p,i)=>act(r,p,{type:'target',target:r.players[(i+1)%4].id}));
 assert.equal(r.phase,'review');assert.ok(r.until>=before+3000&&r.until<=Date.now()+3000);
 const deadline=r.until;tick(r,deadline-1);assert.equal(r.phase,'review');
 tick(r,deadline);assert.equal(r.phase,'choose');assert.equal(r.round,2);
});
test('4·5·6인 행동 선택과 전체 투표의 미제출/완료 표시 및 초기화',()=>{
 for(const n of [4,5,6]){
  const r=setup(n),[a,b]=r.players;
  const seats=()=>view(r,b).players;
  assert.ok(seats().every(p=>p.thinking&&!p.completed&&!p.queued));
  act(r,a,{type:'choose',action:1});
  assert.equal(seats()[0].completed,true);assert.equal(seats()[0].action,null);
  for(const p of r.players.slice(1))act(r,p,{type:'choose',action:1});
  tick(r,Infinity);assert.ok(seats().every(p=>p.thinking));
  act(r,a,{type:'card',index:0});
  assert.equal(seats()[0].completed,true);assert.equal(seats()[0].thinking,false);
  assert.equal(view(r,b).voteResult,null);
  act(r,a,{type:'lobby'});assert.ok(seats().every(p=>!p.thinking&&!p.completed&&!p.queued));
 }
});
test('현재 행동만 차례 대기 표시, 거래 응답이 자신의 대기보다 우선',()=>{
 const r=setup(4),[a,b,c,d]=r.players;
 a.hand=['blank',2,3];b.hand=[0,2,3];
 [a,b,c,d].forEach((p,i)=>act(r,p,{type:'choose',action:i<2?3:4}));
 tick(r,Infinity);
 let ps=view(r,d).players;
 assert.equal(ps[0].thinking,true);assert.equal(ps[1].queued,true);
 assert.equal(ps[2].queued,false);assert.equal(ps[3].queued,false);
 act(r,a,{type:'target',target:b.id});act(r,a,{type:'card',index:0});
 ps=view(r,d).players;assert.equal(ps[0].completed,true);
 assert.equal(ps[1].thinking,true);assert.equal(ps[1].queued,false);
 assert.ok(ps.every(p=>[p.thinking,p.queued,p.completed].filter(Boolean).length<=1));
});
test('거래 선택 말풍선은 요청자에서 응답자로 이동하고 다음 행동자로 넘어간다',()=>{
 const r=setup(4),[a,b,c,d]=r.players;
 a.hand=['blank','wild',2];b.hand=[0,2,3];
 const visible=()=>view(r,d).players.filter(p=>p.thinking).map(p=>p.id);
 assert.deepEqual(visible(),r.players.map(p=>p.id));
 for(const p of [a,b])act(r,p,{type:'choose',action:3});
 for(const p of [c,d])act(r,p,{type:'choose',action:4});
 tick(r,Infinity);assert.deepEqual(visible(),[a.id]);
 act(r,a,{type:'target',target:b.id});assert.deepEqual(visible(),[a.id]);
 assert.equal(view(r,d).task.target,undefined);
 act(r,a,{type:'card',index:0});assert.deepEqual(visible(),[b.id]);
 act(r,b,{type:'card',index:0});assert.deepEqual(visible(),[b.id]);
 assert.equal(view(r,d).players[0].completed,true);
});
test('거래 요청자의 제출 체크와 응답자의 선택 표시를 분리한다',()=>{
 const r=setup(4),[a,b,c,d]=r.players;
 a.hand=['blank','wild',2];b.hand=[0,2,3];
 for(const p of [a,b])act(r,p,{type:'choose',action:3});
 for(const p of [c,d])act(r,p,{type:'choose',action:4});
 assert.ok(view(r,a).players.every(p=>!p.completed));tick(r,Infinity);
 act(r,a,{type:'target',target:b.id});act(r,a,{type:'card',index:0});
 assert.equal(view(r,c).players[0].completed,true);
 assert.equal(view(r,c).players[1].thinking,true);
 assert.equal(view(r,c).players[1].queued,false);
 act(r,b,{type:'card',index:0});
 assert.equal(view(r,c).players[0].completed,true);
 assert.equal(view(r,c).players[1].completed,false);
 act(r,b,{type:'target',target:a.id});act(r,b,{type:'card',index:0});
 if(r.phase==='trade')act(r,a,{type:'card',index:allowed(a)[0]});
 assert.equal(r.phase,'stock');assert.ok(view(r,c).players.every(p=>!p.completed));
});
function setup(n){const r=room(player('Host'));while(r.players.length<n)r.players.push(player('Guest '+r.players.length));start(r);return r;}
test('모든 진행 단계의 퇴장은 판을 초기화하고 사람에게 방장을 넘김',()=>{
 for(const phase of ['choose','reveal','special','watch','trade','stock','vote','voteReview','review','ended']){
  const r=setup(4),host=r.players[0];r.players[1].bot=true;r.phase=phase;r.until=Date.now()+100;r.pendingVote={winner:'오리'};r.voteResult={};r.watches={[host.id]:r.players[2].id};
  leave(r,host);assert.equal(r.host,r.players[1].id);assert.equal(r.phase,'lobby');assert.equal(r.until,null);assert.equal(r.pendingVote,null);assert.equal(r.result,null);assert.equal(r.voteResult,null);assert.equal(r.task,null);assert.equal(r.round,0);assert.deepEqual(r.queue,[]);
  for(const p of r.players){const s=view(r,p);assert.deepEqual(s.hand,[]);assert.equal(s.candidate,null);assert.equal(s.visible,null);assert.equal(s.chosen,null);}
  tick(r,Infinity);assert.equal(r.phase,'lobby');
 }
});
test('대기실 복귀와 봇 제거 권한·새 인원으로 재시작',()=>{
 const r=setup(4),[host,guest]=r.players;
 assert.throws(()=>act(r,guest,{type:'lobby'}));assert.throws(()=>act(r,host,{type:'removeBot'}));
 act(r,host,{type:'lobby'});act(r,host,{type:'bot'});assert.equal(r.players.length,5);
 assert.throws(()=>act(r,guest,{type:'removeBot'}));act(r,host,{type:'removeBot'});assert.equal(r.players.length,4);
 leave(r,guest);assert.throws(()=>act(r,host,{type:'start'}));r.players.push(player('New guest'));act(r,host,{type:'start'});
 assert.equal(r.phase,'choose');assert.equal(r.round,1);assert.ok(r.players.every(p=>p.hand.length===3));assert.equal(r.notice,'');
});
test('이전 판에서 늦게 도착한 입력은 새 판에 반영하지 않음',()=>{
 const r=setup(4),p=r.players[0],old={type:'choose',action:0,gameId:r.gameId,round:r.round};
 act(r,p,{type:'lobby'});act(r,p,{type:'start'});
 assert.throws(()=>act(r,p,old),/이전 판/);assert.deepEqual(r.choices,{});
 act(r,p,{...old,gameId:r.gameId,round:r.round});assert.equal(r.choices[p.id],0);
});
test('연결 유예 중 복귀는 판을 유지하고 3분 단절은 퇴장·대기실로 처리',()=>{
 const r=setup(4),host=r.players[0],now=Date.now();host.lastSeen=now-CONNECTION_WARNING_MS;
 assert.equal(view(r,r.players[1]).players[0].connected,false);
 expireDisconnected(r,now);assert.equal(r.players.length,4);assert.equal(r.phase,'choose');
 host.lastSeen=now;expireDisconnected(r,now+1000);assert.equal(r.players.length,4);
 host.lastSeen=now-DISCONNECT_GRACE_MS;expireDisconnected(r,now);assert.equal(r.players.length,3);assert.equal(r.phase,'lobby');assert.notEqual(r.host,host.id);assert.match(r.notice,/3분/);
});
function choose(r,choices){[...r.players].reverse().forEach(p=>act(r,p,{type:'choose',action:choices[r.players.indexOf(p)]}));assert.notEqual(r.phase,'reveal');}
function finishExchange(r){const p=r.players.find(p=>p.id===r.task.actor);act(r,p,{type:'take',index:0});act(r,p,{type:'card',index:allowed(p)[0]});}
function assertPrivate(r,n){for(const p of r.players){const s=JSON.parse(JSON.stringify(view(r,p)));assert.equal(s.hand.length,n-1);assert.equal(s.stock,undefined);assert.equal(s.duck,undefined);assert.equal(s.task?.offers,undefined);assert.equal(s.task?.take,undefined);for(const q of s.players){assert.equal(q.hand,undefined);assert.equal(q.token,undefined);}}}

for(const n of [4,5,6]){
 test(`${n}인 특수 교환→감시→거래→창고→다음 라운드`,()=>{
  const r=setup(n),[special,watcher,trader,stock]=r.players,initial=inventory(r);
  choose(r,[1,2,3,...Array(n-3).fill(4)]);
  assert.equal(r.phase,'special');act(r,special,{type:'target',target:stock.id});
  assert.deepEqual(view(r,special).visible.hand,stock.hand);assert.equal(view(r,watcher).visible,null);
  finishExchange(r);assert.equal(r.phase,'watch');
  act(r,watcher,{type:'target',target:stock.id});assert.equal(r.phase,'trade');
  act(r,trader,{type:'target',target:stock.id});assert.equal(view(r,trader).visible,null);
  const manual=!stock.hand.includes(stock.color);
  assert.throws(()=>act(r,stock,{type:'card',index:allowed(stock)[0]}));
  act(r,trader,{type:'card',index:allowed(trader)[0]});
  if(manual){assert.equal(r.phase,'trade');act(r,stock,{type:'card',index:allowed(stock)[0]});}
  assert.deepEqual(view(r,watcher).visible.hand,stock.hand);assert.equal(r.phase,'stock');
  for(const p of [...r.players.slice(3)].reverse()){assert.equal(r.task.actor,p.id);assert.equal(view(r,p).stockCount,n+1);finishExchange(r);assert.equal(inventory(r),initial);assertPrivate(r,n);}
  assert.equal(r.phase,'review');assert.deepEqual(view(r,watcher).visible.hand,stock.hand);
  tick(r,Infinity);assert.equal(r.phase,'choose');assert.equal(r.round,2);assert.equal(view(r,watcher).visible,null);assert.equal(inventory(r),initial);
 });
 test(`${n}인 실패한 전체 투표 뒤 감시·창고를 생략하지 않음`,()=>{
  const r=setup(n);
  // A synthetic split vote verifies continuation independently of the shuffled deal.
  r.players.forEach((p,i)=>p.hand[0]=i);
  const initial=inventory(r),submittedHands=r.players.map(p=>[...p.hand]);
  choose(r,[1,1,2,...Array(n-3).fill(4)]);assert.equal(r.phase,'vote');
  r.players.forEach(p=>act(r,p,{type:'card',index:0}));
  assert.equal(r.phase,'voteReview');assert.deepEqual(r.players.map(p=>p.hand),submittedHands);
  tick(r,Infinity);assert.equal(r.phase,'watch');act(r,r.players[2],{type:'target',target:r.players[3].id});
  while(r.phase==='stock')finishExchange(r);
  assert.equal(r.phase,'review');assert.equal(inventory(r),initial);assertPrivate(r,n);
  assert.equal(view(r,r.players[0]).voteResult,null);
  tick(r,Infinity);assert.equal(r.phase,'choose');assert.equal(view(r,r.players[0]).voteResult,null);
 });
 test(`${n}인 봇 연속 입력 200회에서 카드 수·비공개 상태 보존`,()=>{
  const r=setup(n),initial=inventory(r);r.players.forEach(p=>p.bot=true);
  for(let i=0;i<200&&r.phase!=='ended';i++){tick(r,Infinity);assert.equal(inventory(r),initial);assertPrivate(r,n);}
 });
}

test('영상의 6인 무지개 성공·실패 투표를 재현',()=>{
 for(const [votes,expected] of [[[0,0,0,'wild','wild',1],'ended'],[[0,0,'wild','wild',1,2],'voteReview']]){
  const r=setup(6);r.duck=0;r.fake=1;r.players.forEach((p,i)=>p.hand[0]=votes[i]);
  choose(r,Array(6).fill(1));r.players.forEach(p=>act(r,p,{type:'card',index:0}));
  assert.equal(r.phase,'voteReview');assert.equal(r.result,null);assert.ok(view(r,r.players[0]).voteResult);
  if(expected==='ended'){tick(r,Infinity);assert.equal(r.phase,'ended');assert.equal(r.result.winner,'거위');assert.equal(view(r,r.players[0]).voteResult,null);}
 }
});
test('거위에게 기준표가 모이면 오리 승리',()=>{
 const r=setup(4);r.duck=0;r.fake=1;r.players.forEach(p=>p.hand[0]=1);
 choose(r,Array(4).fill(1));r.players.forEach(p=>act(r,p,{type:'card',index:0}));assert.equal(r.result,null);tick(r,Infinity);assert.equal(r.result.winner,'오리');
});

test('승리 투표도 공개 시간을 보장하고 재시작에 이전 판정을 남기지 않음',()=>{
 const r=setup(4);r.duck=0;r.fake=1;
 r.players.forEach(p=>p.hand[0]=0);choose(r,[1,1,4,4]);
 for(const p of r.players.slice(0,3))act(r,p,{type:'card',index:0});
 assert.equal(view(r,r.players[0]).voteResult,null);
 act(r,r.players[3],{type:'card',index:0});
 assert.equal(r.phase,'voteReview');assert.equal(r.result,null);
 assert.equal(view(r,r.players[0]).pendingVote,undefined);
 tick(r,r.until-1);assert.equal(r.phase,'voteReview');assert.equal(r.result,null);
 tick(r,r.until);assert.equal(r.phase,'ended');assert.equal(r.result.winner,'거위');
 assert.equal(r.voteResult,null);assert.equal(r.pendingVote,null);
 act(r,r.players[0],{type:'start'});tick(r,Infinity);
 assert.equal(r.phase,'choose');assert.equal(r.result,null);assert.equal(r.until,null);
});
test('현재 빌드: 4인 기준 충족 동률은 참가자 목록의 첫 최대 후보 선출',()=>{
 const r=setup(4);r.duck=0;r.fake=1;r.players.forEach((p,i)=>p.hand[0]=[0,1,'wild','wild'][i]);
 choose(r,[1,1,2,4]);const hands=r.players.map(p=>[...p.hand]);r.players.forEach(p=>act(r,p,{type:'card',index:0}));assert.equal(r.phase,'voteReview');tick(r,Infinity);assert.equal(r.phase,'ended');assert.equal(r.result.winner,'거위');assert.equal(r.result.duck,r.players[0].id);assert.deepEqual(r.players.map(p=>p.hand),hands);
});
