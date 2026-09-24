import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

test('HTTP 인증·교차 출처·시작 후 참가 경계를 거부함',{timeout:15000},async()=>{
 const port=process.env.LOUNGE_SECURITY_TEST_PORT||'33220';
 const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Test server exited before startup');}),delay(4000).then(()=>{throw Error('Test server startup timeout');})]);
  const base=`http://localhost:${port}`;
  const post=async(path,body,headers={})=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  let response=await post('create',{name:'Security host'}),host=await response.json();
  assert.equal(response.status,200);

  response=await fetch(base+`/api/state?code=${host.code}`,{headers:{Authorization:'Bearer invalid-token'}});
  assert.equal(response.status,401);
  assert.match((await response.json()).error,/방을 찾을 수 없어요/);

  response=await fetch(base+`/api/state?code=${host.code}`,{headers:{Authorization:'Bearer '+host.token,Origin:'https://attacker.example'}});
  assert.equal(response.status,403);

  const guests=[];
  for(let i=1;i<4;i++){
   response=await post('join',{name:'Guest '+i,code:host.code});
   assert.equal(response.status,200);
   guests.push(await response.json());
  }
  response=await post(`action?code=${host.code}`,{type:'start'},{Authorization:'Bearer '+host.token});
  assert.equal(response.status,200);
  response=await post('join',{name:'Late guest',code:host.code});
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/참가할 수 있는 대기실이 아니에요/);
  response=await post(`leave?code=${host.code}`,{}, {Authorization:'Bearer '+host.token,Origin:'https://attacker.example'});
  assert.equal(response.status,403);
  response=await post(`leave?code=${host.code}`,{}, {Authorization:'Bearer '+host.token});assert.equal(response.status,200);
  response=await fetch(base+`/api/state?code=${host.code}`,{headers:{Authorization:'Bearer '+host.token}});assert.equal(response.status,401);
  response=await fetch(base+`/api/state?code=${host.code}`,{headers:{Authorization:'Bearer '+guests[0].token}});
  const remaining=await response.json();assert.equal(remaining.phase,'lobby');assert.equal(remaining.host,remaining.me);assert.deepEqual(remaining.hand,[]);assert.equal(remaining.players.length,3);
  response=await post('join',{name:'Replacement',code:host.code});assert.equal(response.status,200);const replacement=await response.json();
  for(const a of [...guests,replacement]){response=await post(`leave?code=${host.code}`,{},{Authorization:'Bearer '+a.token});assert.equal(response.status,200);}
  response=await post('join',{name:'Closed room',code:host.code});assert.equal(response.status,400);
 }finally{
  if(child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}
 }
});
