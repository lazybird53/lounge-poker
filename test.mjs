import test from 'node:test';
import assert from 'node:assert/strict';
import {room,player,start,act as engineAct,view,allowed,tick} from './engine.mjs';
// Existing rule tests skip only the new presentation delay.
function act(r,p,b){engineAct(r,p,b);if(r.phase==='reveal'||(r.phase==='voteReview'&&r.pendingVote))tick(r,Infinity);}
function setup(n=4){const r=room(player('A'));while(r.players.length<n)r.players.push(player('P'+r.players.length));start(r);return r;}
test('감시 선택자는 순서와 무관하게 대상을 고르고 전원 완료 후 거래로 진행',()=>{
 const r=setup(),[a,b,c,d]=r.players;
 r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i<3?2:3}));
 for(const p of [a,b,c])assert.equal(view(r,p).task.actor,p.id);
 assert.equal(view(r,d).task,null);
 assert.throws(()=>act(r,d,{type:'target',target:a.id}));
 act(r,c,{type:'target',target:d.id});
 assert.equal(r.phase,'watch');assert.equal(view(r,c).visible.id,d.id);assert.equal(view(r,c).task,null);
 assert.throws(()=>act(r,c,{type:'target',target:a.id}));
 act(r,a,{type:'target',target:b.id});assert.equal(r.phase,'watch');
 act(r,b,{type:'target',target:c.id});assert.equal(r.phase,'trade');assert.equal(r.task.actor,d.id);
});
test('일반 거래 수신자의 자기 색은 자동 제출되고 시작자는 다른 카드를 낼 수 없음',()=>{
 const r=setup(),[a,b]=r.players;
 a.hand=[a.color,'blank','wild'];b.hand=[b.color,'blank','wild'];
 r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i===0?3:4}));
 act(r,a,{type:'target',target:b.id});
 const before=r.players.map(p=>[...p.hand]);
 assert.equal(r.task.offers?.[b.id],undefined);
 assert.equal(view(r,b).task.target,undefined);
 assert.throws(()=>act(r,b,{type:'card',index:0}));
 assert.throws(()=>act(r,b,{type:'card',index:1}));
 assert.throws(()=>act(r,a,{type:'card',index:1}));
 assert.throws(()=>act(r,a,{type:'card',index:2}));
 assert.equal(r.task.offers?.[a.id],undefined);
 assert.deepEqual(r.players.map(p=>p.hand),before);
 act(r,a,{type:'card',index:0});
 assert.deepEqual(a.hand,[b.color,'blank','wild']);
 assert.deepEqual(b.hand,[a.color,'blank','wild']);
});
test('자기 색 투표도 자신을 선출하는 기준표에 포함됨',()=>{
 const r=setup();r.duck=0;r.fake=1;
 // The candidate's own vote is necessary: excluding it would leave only 2 of 3 required votes.
 r.players.forEach((p,i)=>p.hand=[i<3?0:'blank','blank','blank']);
 r.players.forEach(p=>act(r,p,{type:'choose',action:1}));
 const before=r.players.map(p=>[...p.hand]);
 r.players.forEach(p=>act(r,p,{type:'card',index:0}));
 assert.equal(r.phase,'ended');
 assert.equal(r.result.winner,'거위');
 assert.equal(r.result.duck,r.players[0].id);
 assert.deepEqual(r.players.map(p=>p.hand),before);
});
test('특수 교환 피해자는 대상 지정과 같은 카드 교환을 통보받지 않음',()=>{let r=setup(),[a,b,c]=r.players;a.hand=['blank','blank','blank'];b.hand=['blank','blank','blank'];r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i===0?1:4}));const before=[...b.hand];act(r,a,{type:'target',target:b.id});assert.equal(view(r,a).task.target,b.id);assert.equal(view(r,b).task.target,undefined);assert.equal(view(r,c).task.target,undefined);assert.throws(()=>act(r,b,{type:'card',index:0}));act(r,a,{type:'take',index:0});act(r,a,{type:'card',index:0});assert.deepEqual(b.hand,before);assert.ok(!r.log.some(line=>line.includes(b.name)&&line.includes('특수')));});
test('오리 버튼은 전원 선택 전에는 판정하지 않음',()=>{let r=setup();act(r,r.players[0],{type:'choose',action:0});assert.equal(r.phase,'choose');assert.equal(r.result,null);r.players.slice(1).forEach(p=>act(r,p,{type:'choose',action:4}));assert.equal(r.result.winner,'오리');});
test('같은 버튼은 서버가 선택 요청을 처리한 순서대로 진행',()=>{let r=setup(6),order=[5,3,1,4,2,0];order.forEach(i=>act(r,r.players[i],{type:'choose',action:4}));for(const i of order){let p=r.players[i];assert.equal(r.task.actor,p.id);act(r,p,{type:'take',index:0});act(r,p,{type:'card',index:allowed(p)[0]});}assert.equal(r.phase,'review');});
test('창고는 뒷면 선택이 먼저이며 서버는 카드 내용을 노출하지 않음',()=>{let r=setup(),a=r.players[0],b=r.players[1];r.players.forEach(p=>act(r,p,{type:'choose',action:4}));assert.equal(view(r,a).stockCount,5);assert.equal(view(r,b).stockCount,null);assert.equal(view(r,a).stock,undefined);assert.equal(view(r,a).task.stage,'receive');assert.throws(()=>act(r,a,{type:'card',index:allowed(a)[0]}));assert.throws(()=>act(r,b,{type:'take',index:0}));assert.throws(()=>act(r,a,{type:'take',index:5}));let original=[...a.hand],stock=[...r.stock];r.task.displayOrder=[4,3,1,2,0];act(r,a,{type:'take',index:2});assert.deepEqual(a.hand,original);assert.equal(view(r,a).task.stage,'give');assert.equal(view(r,a).stockCount,null);assert.equal(view(r,a).task.take,undefined);assert.throws(()=>act(r,a,{type:'take',index:1}));let give=allowed(a)[0];act(r,a,{type:'card',index:give});assert.equal(a.hand[give],stock[1]);assert.equal(r.stock[1],original[give]);assert.equal(r.stock[2],stock[2]);});
test('특수 교환 단계 생략과 상대방 조작을 거부',()=>{let r=setup(),a=r.players[0],b=r.players[1];r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i===0?1:4}));assert.equal(view(r,a).task.stage,'target');assert.throws(()=>act(r,a,{type:'take',index:0}));act(r,a,{type:'target',target:b.id});assert.equal(view(r,a).task.stage,'receive');assert.throws(()=>act(r,a,{type:'card',index:allowed(a)[0]}));assert.throws(()=>act(r,b,{type:'take',index:0}));act(r,a,{type:'take',index:0});assert.equal(view(r,a).task.stage,'give');assert.equal(view(r,a).visible,null);});
test('투표는 자기 색을 제출할 수 있고 손패를 소모하지 않음',()=>{let r=setup();r.players.forEach((p,i)=>{p.hand=[i,'blank','wild'];act(r,p,{type:'choose',action:1});});const hands=r.players.map(p=>[...p.hand]);r.players.forEach(p=>act(r,p,{type:'card',index:0}));assert.equal(r.phase,'voteReview');assert.deepEqual(r.players.map(p=>p.hand),hands);});
test('앞선 거래 결과를 적용한 뒤 다음 거래를 요청',()=>{let r=setup(),[a,b,c]=r.players;r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i<2?3:4}));a.hand=['blank','wild',2];b.hand=['blank',2,3];c.hand=['blank',1,3];act(r,a,{type:'target',target:b.id});act(r,a,{type:'card',index:1});act(r,b,{type:'card',index:0});assert.equal(r.task.actor,b.id);assert.equal(b.hand[0],'wild');act(r,b,{type:'target',target:c.id});act(r,b,{type:'card',index:0});act(r,c,{type:'card',index:allowed(c)[0]});assert.ok(c.hand.includes('wild'));});
test('일반 거래는 양쪽 당사자에게 상대 손패를 공개하지 않음',()=>{let r=setup(),a=r.players[0],b=r.players[1];r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i===0?3:4}));act(r,a,{type:'target',target:b.id});assert.equal(view(r,a).visible,null);assert.equal(view(r,b).visible,null);act(r,a,{type:'card',index:allowed(a)[0]});assert.equal(view(r,b).visible,null);assert.equal(view(r,b).task.offers,undefined);});
test('거래 중 보이는 손패는 해당 플레이어가 감시한 대상만임',()=>{let r=setup(),watcher=r.players[0],trader=r.players[1],other=r.players[2];r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i===0?2:i===1?3:4}));act(r,watcher,{type:'target',target:other.id});act(r,trader,{type:'target',target:watcher.id});assert.equal(view(r,watcher).visible.id,other.id);assert.equal(view(r,trader).visible,null);});
test('행동 공개와 감시 결과가 즉시 사라지지 않음',()=>{let r=setup();r.players.forEach(p=>engineAct(r,p,{type:'choose',action:2}));assert.equal(r.phase,'watch');while(r.phase==='watch'){let p=r.players.find(x=>x.id===r.task.actor);engineAct(r,p,{type:'target',target:r.players.find(x=>x.id!==p.id).id});}assert.equal(r.phase,'review');assert.ok(view(r,r.players[0]).visible);tick(r,Infinity);assert.equal(r.phase,'choose');assert.equal(r.round,2);assert.equal(view(r,r.players[0]).visible,null);});
test('봇은 한 tick에 하나의 입력만 수행',()=>{let r=setup();r.players.slice(1).forEach(p=>p.bot=true);tick(r);assert.equal(Object.keys(r.choices).length,1);tick(r);assert.equal(Object.keys(r.choices).length,2);});
test('4~6인 카드 수 보존 및 비공개 정보 분리',()=>{for(let n=4;n<=6;n++){let r=setup(n);assert.equal(r.stock.length,n+1);assert.equal(r.players.flatMap(p=>p.hand).length+r.stock.length,n*n+1);for(let p of r.players){let v=view(r,p);assert.equal(v.hand.length,n-1);assert.notEqual(v.candidate,p.id);assert.equal(v.duck,undefined);assert.equal(v.players[0].hand,undefined);assert.equal(v.players[0].token,undefined);assert.equal(v.candidate,r.players[p.color===r.duck?r.fake:r.duck].id);}}});
test('현재 빌드 덱은 4·5인 경계 카드만 한 슬롯 중첩되고 6인은 중첩 없음',()=>{for(let n=4;n<=6;n++){let r=setup(n),slots=[...r.players.flatMap(p=>p.hand),...r.stock],expected=new Map([...Array(n).keys()].map(i=>[i,n-1]).concat([['blank',n-1],['wild',Math.max(1,n-4)]]));let surplus=[];for(const [card,base] of expected){let extra=slots.filter(x=>x===card).length-base;if(extra)surplus.push([card,extra]);}assert.deepEqual(surplus,n<6?[[r.players.at(-1).hand.at(-1),1]]:[]);if(n<6)assert.equal(r.stock[0],r.players.at(-1).hand.at(-1));}});
test('선택 완료 전 다른 사람 행동은 숨겨짐, 중복 선택 거부',()=>{let r=setup(),p=r.players[0];act(r,p,{type:'choose',action:3});assert.equal(view(r,r.players[1]).players[0].action,null);assert.throws(()=>act(r,p,{type:'choose',action:2}));});
test('누가 오리 버튼을 눌러도 오리 승리',()=>{let r=setup();r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i===0?0:4}));assert.equal(r.result.winner,'오리');});
test('무지개는 실제 오리의 득표에 포함, 투표 중에는 표 비공개',()=>{let r=setup();r.players.forEach((p,i)=>{p.hand=[i===0?'wild':i===3?'blank':r.duck,0,0];act(r,p,{type:'choose',action:1});});act(r,r.players[0],{type:'card',index:0});assert.equal(view(r,r.players[1]).voteResult,null);r.players.slice(1).forEach(p=>act(r,p,{type:'card',index:0}));assert.equal(r.result.winner,'거위');});
test('자기 색 우선 제약 및 창고 카드 보존',()=>{let r=setup();r.players.forEach(p=>act(r,p,{type:'choose',action:4}));let p=r.players.find(p=>p.id===r.task.actor);p.hand=[p.color,'blank','wild'];assert.deepEqual(allowed(p),[0]);act(r,p,{type:'take',index:0});assert.throws(()=>act(r,p,{type:'card',index:1}));let before=[...p.hand,...r.stock].sort();act(r,p,{type:'card',index:0});assert.deepEqual([...p.hand,...r.stock].sort(),before);});
test('일반 거래는 양쪽이 선택한 뒤 교환',()=>{let r=setup();r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i===0?3:4}));let a=r.players[0],b=r.players[1];a.hand=['blank','wild',2];b.hand=['blank',2,3];act(r,a,{type:'target',target:b.id});act(r,a,{type:'card',index:1});assert.equal(a.hand[1],'wild');act(r,b,{type:'card',index:0});assert.equal(a.hand[1],'blank');assert.equal(b.hand[0],'wild');});
test('1인 투표 특수 교환은 선택자에게만 상대 손패 공개',()=>{let r=setup();r.players.forEach((p,i)=>act(r,p,{type:'choose',action:i===0?1:4}));let a=r.players[0],b=r.players[1];act(r,a,{type:'target',target:b.id});assert.deepEqual(view(r,a).visible.hand,b.hand);assert.equal(view(r,r.players[2]).visible,null);let own=allowed(a)[0],old=a.hand[own],other=b.hand[0];act(r,a,{type:'take',index:0});assert.equal(view(r,a).visible,null);act(r,a,{type:'card',index:own});assert.equal(a.hand[own],other);assert.equal(b.hand[0],old);});
