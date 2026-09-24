async page => {
 const root='http://localhost:3211',results=[],errors=[];
 for(const n of [5,6]){
  const request=async(path,a,data)=>{const r=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data});if(!r.ok())throw Error(await r.text());return r.json()};
  const auths=[await request('create',null,{name:'감시 0'})];
  for(let i=1;i<n;i++)auths.push(await request('join',null,{name:'참가자 '+i,code:auths[0].code}));
  const tabs=[];
  for(let i=0;i<n;i++){const p=await page.context().newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);await p.setViewportSize({width:390,height:844});await p.goto(root);await p.evaluate(a=>sessionStorage.setItem('lounge',JSON.stringify(a)),auths[i]);await p.reload();tabs.push(p)}
  const state=async i=>{const r=await page.request.get(root+'/api/state?code='+auths[i].code,{headers:{Authorization:'Bearer '+auths[i].token}});return r.json()};
  await tabs[0].locator('#start').click();
  let initial=await Promise.all(auths.map((_,i)=>state(i)));
  // Natural redeals, never edit hands: watcher 0 must need a manual response.
  for(let attempt=0;initial[0].hand.includes(0)&&attempt<20;attempt++){
   await request('action',auths[0],{type:'lobby'});await request('action',auths[0],{type:'start'});
   initial=await Promise.all(auths.map((_,i)=>state(i)));
  }
  const recipient=0;
  if(initial[0].hand.includes(0))throw Error('No suitable natural deal after 20 attempts');
  for(let i=0;i<n;i++){await tabs[i].bringToFront();await tabs[i].locator('[data-action="'+(i<2?2:i===2?3:4)+'"]').click();}
  for(const i of [1,0]){await tabs[i].bringToFront();await tabs[i].locator('.seat[data-target="'+initial[2].me+'"]').click();}
  const before=await state(0);
  await tabs[2].bringToFront();await tabs[2].locator('.seat[data-target="'+initial[recipient].me+'"]').click();
  if((await state(recipient)).task.target!==undefined)throw Error('early recipient target');
  await tabs[2].locator('[data-card]:not([disabled])').first().click();
  const responding=(await state(recipient)).phase==='trade';
  if(!responding)throw Error('Expected manual trade response');
  await tabs[recipient].bringToFront();await tabs[recipient].locator('.handpanel [data-card]:not([disabled])').first().waitFor();
  if(await tabs[recipient].locator('.surveillance button').count())throw Error('Observed hand became interactive');
  const layout=await tabs[recipient].evaluate(()=>{
   const panel=document.querySelector('.surveillance').getBoundingClientRect(),hand=document.querySelector('.handpanel').getBoundingClientRect(),prompt=document.querySelector('.table-prompt').getBoundingClientRect();
   return {overlap:panel.bottom>hand.top,overflow:document.documentElement.scrollWidth>innerWidth,promptAfterHand:prompt.bottom>hand.top};
  });
  if(Object.values(layout).some(Boolean))throw Error('Mobile reply layout '+JSON.stringify(layout));
  await tabs[recipient].screenshot({path:'output/playwright/flow-'+n+'-mobile-watch-reply.png',fullPage:true});
  const a=await state(2),b=await state(0),offer=a.task.submitted;
  if(!offer||!b.visible||b.visible.id!==a.me)throw Error('Watcher reply context incorrect');
  await tabs[recipient].locator('.handpanel [data-card]:not([disabled])').first().click();
  await tabs[0].bringToFront();
  await tabs[0].locator('.stage-panel.surveillance').waitFor();
  await tabs[0].screenshot({path:'output/playwright/flow-'+n+'-mobile-watch.png',fullPage:true});
  for(let i=3;i<n;i++){
   await tabs[i].bringToFront();
   await tabs[i].locator('[data-take]').first().click();
   await tabs[i].locator('[data-card]:not([disabled])').first().click();
  }
  await tabs[0].bringToFront();await tabs[0].locator('.logs').getByText('2번째 라운드 · 행동을 선택하세요.',{exact:true}).waitFor({state:'attached'});
  if(await tabs[0].locator('.stage-panel.surveillance').count())throw Error('watch persisted');
  for(let i=0;i<n;i++){await tabs[i].bringToFront();await tabs[i].locator('[data-action="'+(i===0?1:4)+'"]').click();}
  await tabs[0].bringToFront();
  await tabs[0].locator('[data-target]').first().click();
  await tabs[0].locator('.visible [data-take]').first().click();
  await tabs[0].locator('[data-card]:not([disabled])').first().click();
  for(let i=1;i<n;i++){await tabs[i].bringToFront();await tabs[i].locator('.stage-panel [data-take]').first().click();await tabs[i].locator('[data-card]:not([disabled])').first().click()}
  await tabs[0].bringToFront();await tabs[0].locator('.logs').getByText('3번째 라운드 · 행동을 선택하세요.',{exact:true}).waitFor({state:'attached'});
  const overflow=await tabs[0].evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('horizontal overflow');
  results.push({players:n,manualTradeResponse:responding,watchTradeStock:true,specialStock:true,nextRound:3});
  for(const p of tabs)await p.close();
  for(const a of auths)await request('leave',a,{});
 }
 if(errors.length)throw Error(JSON.stringify(errors));
 return {results,pageErrors:errors.length};
}
