async page => {
 const root='http://localhost:3211', results=[];
 await page.goto(root);
 for(const n of [4,5,6]){
  const request=async(path,a,data)=>{const r=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data});if(!r.ok())throw Error(await r.text());return r.json()};
  const auth=await request('create',null,{name:'화면 검증'});
  for(let i=1;i<n;i++)await request('join',null,{name:'참가자 '+i,code:auth.code});
  await page.evaluate(a=>sessionStorage.setItem('lounge',JSON.stringify(a)),auth);await page.reload();
  await page.locator('#start').click();await page.locator('.handpanel').waitFor();
  for(const size of [{width:1440,height:900},{width:1024,height:900},{width:390,height:844}]){
   await page.setViewportSize(size);
   const metrics=await page.evaluate(()=>{const hand=document.querySelector('.handpanel').getBoundingClientRect();const buttons=[...document.querySelectorAll('[data-action]')].map(x=>x.getBoundingClientRect());return {handBottom:hand.bottom,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,buttons:buttons.length}});
   metrics.seatOverlap=await page.evaluate(()=>{const c=document.querySelector('.table-center').getBoundingClientRect();return [...document.querySelectorAll('.seat')].some(el=>{const s=el.getBoundingClientRect();return s.left<c.right&&s.right>c.left&&s.top<c.bottom&&s.bottom>c.top})});
   if(metrics.overflow||metrics.handBottom>size.height||metrics.buttons!==5||metrics.seatOverlap)throw Error(JSON.stringify({n,size,metrics}));
   await page.screenshot({path:'output/playwright/layout-'+n+'-'+size.width+'.png',fullPage:true});results.push({n,width:size.width,...metrics});
  }
 }
 return results;
}
