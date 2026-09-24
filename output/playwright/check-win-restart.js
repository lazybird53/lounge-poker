async page => {
 const root='http://localhost:3211', errors=[];
 const request=async(path,a,data)=>{const r=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data});if(!r.ok())throw Error(await r.text());return r.json()};
 let auths,states,color,attempt;
 for(attempt=1;attempt<=30;attempt++){
  auths=[await request('create',null,{name:'승리 검증 0'})];
  for(let i=1;i<4;i++)auths.push(await request('join',null,{name:'승리 검증 '+i,code:auths[0].code}));
  await request('action',auths[0],{type:'start'});
  states=await Promise.all(auths.map(async a=>(await page.request.get(root+'/api/state?code='+a.code,{headers:{Authorization:'Bearer '+a.token}})).json()));
  color=[0,1,2,3].find(c=>states.filter(s=>s.hand.some(v=>v===c||v==='wild')).length>=3);
  if(color!==undefined)break;
 }
 if(color===undefined)throw Error('No naturally winning distribution found');
 const tabs=[];
 for(const a of auths){const p=await page.context().newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);await p.goto(root);await p.evaluate(a=>sessionStorage.setItem('lounge',JSON.stringify(a)),a);await p.reload();tabs.push(p)}
 for(const p of tabs){await p.bringToFront();await p.locator('[data-action="1"]').click()}
 for(let i=0;i<4;i++){const p=tabs[i];await p.bringToFront();const preferred=states[i].hand.findIndex(c=>c===color||c==='wild');await p.locator('[data-card="'+Math.max(0,preferred)+'"]').click()}
 await tabs[0].bringToFront();await tabs[0].locator('.vote-card').first().waitFor();
 if(await tabs[0].locator('.result').count())throw Error('Premature result');
 await tabs[0].locator('#restart').waitFor();
 const result=await tabs[0].locator('.result').innerText();
 await tabs[0].screenshot({path:'output/playwright/win-before-restart.png',fullPage:true});
 await tabs[0].setViewportSize({width:390,height:844});
 await tabs[0].screenshot({path:'output/playwright/win-mobile.png',fullPage:true});
 if(await tabs[0].evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile result overflow');
 if(!await tabs[0].locator('.winner-lineup figure').count())throw Error('No winners shown');
 await tabs[0].locator('#restart').click();
 await tabs[0].locator('[data-action="1"]:not([disabled])').waitFor();
 for(const p of tabs){await p.bringToFront();await p.locator('[data-action="1"]:not([disabled])').waitFor();if(await p.locator('.result,.vote-card').count())throw Error('Old result after restart');}
 for(const a of auths){
  const s=await (await page.request.get(root+'/api/state?code='+a.code,{headers:{Authorization:'Bearer '+a.token}})).json();
  if(s.gameId===states[0].gameId||s.round!==1||s.phase!=='choose'||s.hand.length!==3||s.chosen!==null||s.voted||s.visible||s.task||s.result||s.voteResult)throw Error('Restart state not clean');
  if(s.players.some(p=>p.completed||p.queued||p.action!=null||'hand' in p))throw Error('Old or private player state exposed');
 }
 await tabs[0].screenshot({path:'output/playwright/win-after-restart.png',fullPage:true});
 for(const p of tabs)await p.close();
 for(const a of auths)await request('leave',a,{});
 if(errors.length)throw Error(errors.join('\n'));
 return {naturalDealAttempts:attempt,winningColor:color,result,restartAllFourTabs:true,pageErrors:0};
}
