async page=>{
 const root='http://localhost:3211',auths=[],tabs=[],errors=[];
 const post=async(path,a,data)=>{const r=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data});if(!r.ok())throw Error(await r.text());return r.json()};
 const state=async a=>(await page.request.get(root+'/api/state?code='+a.code,{headers:{Authorization:'Bearer '+a.token}})).json();
 try{
  auths.push(await post('create',null,{name:'요청자'}));
  for(let i=1;i<4;i++)auths.push(await post('join',null,{name:'참가자 '+i,code:auths[0].code}));
  await post('action',auths[0],{type:'start'});
  let recipient=await state(auths[1]);
  for(let i=0;recipient.hand.includes(1)&&i<30;i++){await post('action',auths[0],{type:'lobby'});await post('action',auths[0],{type:'start'});recipient=await state(auths[1]);}
  if(recipient.hand.includes(1))throw Error('No manual response deal');
  for(const a of auths.slice(0,2)){const p=await page.context().newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);await p.goto(root);await p.evaluate(a=>sessionStorage.setItem('lounge',JSON.stringify(a)),a);await p.reload();tabs.push(p);}
  for(let i=0;i<4;i++)await post('action',auths[i],{type:'choose',action:i===0?3:4});
  const [actor,other]=tabs;await actor.bringToFront();await actor.locator('[data-target="'+recipient.me+'"]').click();
  let accepted=0;
  await actor.route('**/api/state?*',r=>r.abort());
  await actor.route('**/api/action?*',async r=>{await r.fetch();accepted++;await r.abort();},{times:1});
  await actor.locator('[data-card]:not([disabled])').first().click();
  await actor.locator('#connectionStatus:not([hidden])').waitFor();
  if(!(await state(auths[0])).task.submitted)throw Error('Server never accepted submission');
  await actor.unroute('**/api/state?*');await actor.locator('.table-prompt').filter({hasText:'상대의 카드 선택 대기'}).waitFor();
  if(accepted!==1||await actor.locator('[data-card]').count())throw Error('Lost response replayed input');
  await other.bringToFront();await other.locator('[data-card]').first().waitFor();await other.reload();await other.locator('[data-card]').first().waitFor();
  let requests=0;
  await other.route('**/api/action?*',async r=>{requests++;await other.waitForTimeout(800);await r.continue();});
  const button=other.locator('[data-card]:not([disabled])').first(),box=await button.boundingBox();await button.click();
  // A real second pointer click must be swallowed by pending state, not retried until actionable.
  await other.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await other.locator('.table[data-phase="stock"]').waitFor();
  if(requests!==1)throw Error('Duplicate response requests '+requests);
  const after=await state(auths[0]);if(after.log.filter(s=>s.includes('거래 완료')).length!==1)throw Error('Trade not exactly once');
  if(errors.length)throw Error(errors.join('\n'));
  return {acceptedResponseLostRecovered:true,reloadPreservedManualReply:true,doubleClickSingleSubmission:true,tradeCompletedOnce:true,pageErrors:0};
 }finally{for(const p of tabs)await p.close();for(const a of auths)await post('leave',a,{});}
}
