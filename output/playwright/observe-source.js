async page => {
 const frames=[];
 for(const time of [1827,1829,1831,1834,1840]){
  await page.locator('video').evaluate(async(v,time)=>{v.pause();v.muted=true;v.currentTime=time;await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('seek timeout')),15000);v.addEventListener('seeked',()=>{clearTimeout(timeout);resolve()},{once:true})});},time);
  await page.locator('video').screenshot({path:'output/playwright/source-trade-'+time+'.png'});
  frames.push(await page.locator('video').evaluate(v=>({time:v.currentTime,ready:v.readyState})));
 }
 return {source:page.url(),frames};
}
