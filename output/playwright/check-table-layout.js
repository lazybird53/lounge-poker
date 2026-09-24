async page => {
 const root='http://localhost:3211',results=[];
 const post=async(path,a,data)=>{const r=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data});if(!r.ok())throw Error(await r.text());return r.json()};
 const login=async a=>{await page.goto(root);await page.evaluate(a=>sessionStorage.setItem('lounge',JSON.stringify(a)),a);await page.reload();await page.locator('.table').waitFor()};
 const check=async(label,size)=>{
  await page.setViewportSize(size);
  const metrics=await page.evaluate(()=>{
   const rect=s=>document.querySelector(s)?.getBoundingClientRect();
   const hand=rect('.handpanel'),panel=rect('.stage-panel')||rect('.table-center'),prompt=rect('.table-prompt');
   const overlap=(a,b)=>a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   return {overflow:document.documentElement.scrollWidth>innerWidth,handBottom:hand.bottom,handPanelOverlap:!!overlap(hand,panel),handPromptOverlap:!!overlap(hand,prompt),seatPanelOverlap:[...document.querySelectorAll('.seat')].some(s=>overlap(s.getBoundingClientRect(),panel)),cardsClipped:!!document.querySelector('.stage-panel')&&document.querySelector('.stage-panel').scrollWidth>document.querySelector('.stage-panel').clientWidth};
  });
  if(metrics.overflow||metrics.handPanelOverlap||metrics.handPromptOverlap||metrics.seatPanelOverlap||metrics.cardsClipped||(size.width>700&&metrics.handBottom>size.height))throw Error(JSON.stringify({label,size,metrics}));
  await page.screenshot({path:'output/playwright/table-'+label+'-'+size.width+'.png',fullPage:true});results.push({label,...size,...metrics});
 };
 const sizes=[{width:1280,height:720},{width:390,height:844}];
 for(const n of [4,5,6]){
  const auths=[await post('create',null,{name:'화면 검증'})];
  for(let i=1;i<n;i++)auths.push(await post('join',null,{name:'참가자 '+i,code:auths[0].code}));
  await post('action',auths[0],{type:'start'});await login(auths[0]);
  for(const size of sizes)await check(n+'-choose',size);
  if(n!==6)continue;
  for(let i=0;i<n;i++)await post('action',auths[i],{type:'choose',action:i===0?2:4});
  await page.locator('.seat[data-target]').first().click();
  await page.locator('.stage-panel.surveillance').waitFor();
  for(const size of sizes)await check('6-watch',size);
  await login(auths[1]);await page.locator('.stage-panel [data-take]').first().waitFor();
  for(const size of sizes)await check('6-stock',size);
 }
 return results;
}
