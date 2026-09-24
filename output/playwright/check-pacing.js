async page=>{
 const root='http://localhost:3211',results=[],errors=[];
 const post=async(path,a,data)=>{const res=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data});if(!res.ok())throw Error(await res.text());return res.json()};
 for(const n of [4,5,6]){
  const auths=[await post('create',null,{name:'시간 측정'})];
  for(let i=1;i<n;i++)auths.push(await post('join',null,{name:'참가자 '+i,code:auths[0].code}));
  const p=await page.context().newPage();p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(root);await p.evaluate(a=>sessionStorage.setItem('lounge',JSON.stringify(a)),auths[0]);await p.reload();await p.bringToFront();
   await p.locator('#start').click();
   await p.evaluate(()=>{
    window.phaseTimes=[];
    new MutationObserver(()=>{const phase=document.querySelector('.table')?.dataset.phase;if(phase&&window.phaseTimes.at(-1)?.phase!==phase)window.phaseTimes.push({phase,time:performance.now()});}).observe(document.querySelector('#app'),{childList:true,subtree:true});
   });
   for(let round=1;round<=2;round++){
    const ids=[];
    for(let i=1;i<n;i++){const s=await post('action',auths[i],{type:'choose',action:2});ids[i]=s.me;}
    const before=await p.evaluate(()=>performance.now());
    await p.locator('[data-action="2"]').click();await p.locator('.table[data-phase="watch"]').waitFor();
    const choiceMs=await p.evaluate(t=>performance.now()-t,before);
    for(let i=1;i<n;i++)await post('action',auths[i],{type:'target',target:ids[i===n-1?1:i+1]});
    await p.locator('[data-target]').first().click();await p.locator('.table[data-phase="review"]').waitFor();
    const checks=await p.locator('.completion').count();if(checks!==n)throw Error('Missing review checks '+checks+'/'+n);
    await p.locator('.table[data-phase="choose"]').waitFor({timeout:6000});
    const reviewMs=await p.evaluate(()=>{const a=window.phaseTimes;return a.at(-1).time-a.at(-2).time});
    if(await p.locator('.completion').count())throw Error('Checks persisted into next round');
    if(choiceMs>1500||reviewMs<2800||reviewMs>3600)throw Error(JSON.stringify({n,round,choiceMs,reviewMs}));
    results.push({players:n,round,choiceToWatchMs:Math.round(choiceMs),reviewVisibleMs:Math.round(reviewMs)});
   }
  }finally{await p.close();for(const a of auths)await post('leave',a,{});}
 }
 if(errors.length)throw Error(errors.join('\n'));
 return {results,pageErrors:errors.length,scope:'Local foreground browser; other participants submitted through HTTP, host through UI'};
}
