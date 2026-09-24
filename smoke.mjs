import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

for(const n of [4,5,6])test(`HTTP ${n}인 창고 교환: 입력 순서, 권한, 비공개 응답`, {timeout:15000}, async()=>{
 const port=process.env.LOUNGE_TEST_PORT||'33219';
 const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Test server exited before startup');}),delay(4000).then(()=>{throw Error('Test server startup timeout');})]);
  const base=`http://localhost:${port}`;
  const request=async(path,auth,body,expected=200)=>{
   const res=await fetch(base+'/api/'+path+(auth?'?code='+auth.code:''),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth.token}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const result=await res.json();assert.equal(res.status,expected,JSON.stringify(result));return result;
  };
  assert.equal((await fetch(base)).status,200);
  const host=await request('create',null,{name:'HTTP host'}),auths=[host];
  for(let i=1;i<n;i++)auths.push(await request('join',null,{name:'HTTP guest '+i,code:host.code}));
  await request('action',host,{type:'start'});
  const submissionOrder=[...auths].reverse();
  for(const auth of submissionOrder)await request('action',auth,{type:'choose',action:4});
  let state;
  for(let i=0;i<12;i++){state=await request('state',host);if(state.phase==='stock')break;await delay(350);}
  assert.equal(state.phase,'stock');
  const states=await Promise.all(auths.map(auth=>request('state',auth)));
  const actorIndex=states.findIndex(s=>s.task.actor===s.me),actorAuth=auths[actorIndex],actorState=states[actorIndex];
  const observerIndex=actorIndex===0?1:0,observerAuth=auths[observerIndex],observer=states[observerIndex];
  assert.equal(actorAuth.token,submissionOrder[0].token);assert.equal(actorState.task.stage,'receive');assert.equal(actorState.stockCount,n+1);
  const oldHand=actorState.hand;
  assert.equal(observer.stockCount,null);assert.equal(observer.players[0].hand,undefined);
  await request('action',actorAuth,{type:'card',index:actorState.allowed[0]},400);
  await request('action',observerAuth,{type:'take',index:0},400);
  state=await request('action',actorAuth,{type:'take',index:0});
  assert.equal(state.task.stage,'give');assert.equal(state.stockCount,null);assert.equal(state.task.take,undefined);assert.deepEqual(state.hand,oldHand);
  state=await request('action',actorAuth,{type:'card',index:state.allowed[0]});
  const next=await request('state',submissionOrder[1]);
  assert.equal(state.task.actor,next.me);assert.equal(state.hand.length,n-1);
 }finally{
  if(child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}
 }
});
