async page => {
 const root='http://localhost:3211';
 const post=async(path,a,data)=>{const r=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data});if(!r.ok())throw Error(await r.text());return r.json()};
 const auths=[await post('create',null,{name:'투표 검증 0'})];
 for(let i=1;i<4;i++)auths.push(await post('join',null,{name:'투표 검증 '+i,code:auths[0].code}));
 const tabs=[],errors=[];
 for(const a of auths){const p=await page.context().newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(root);await p.evaluate(a=>sessionStorage.setItem('lounge',JSON.stringify(a)),a);await p.reload();tabs.push(p)}
 await tabs[0].bringToFront();await tabs[0].locator('#start').click();
 for(const p of tabs){await p.bringToFront();await p.locator('[data-action="1"]').click()}
 await tabs[0].evaluate(()=>{window.voteTimes=[];new MutationObserver(()=>{const phase=document.querySelector('.table')?.dataset.phase;if(phase&&window.voteTimes.at(-1)?.phase!==phase)window.voteTimes.push({phase,time:performance.now()});}).observe(document.querySelector('#app'),{childList:true,subtree:true});});
 for(const p of tabs){await p.bringToFront();await p.locator('[data-card]').first().click()}
 await tabs[0].bringToFront();
 await tabs[0].locator('.vote-card').first().waitFor();
 const count=await tabs[0].locator('.vote-card .card').count();
 if(count!==4)throw Error('expected 4 revealed votes, got '+count);
 if(await tabs[0].locator('.result').count())throw Error('result appeared during review');
 await tabs[0].screenshot({path:'output/playwright/vote-review-4.png',fullPage:true});
 await tabs[0].locator('.vote-card').first().waitFor({state:'detached',timeout:12000});
 const result=await tabs[0].locator('.result').count();
 const publicDisplayMs=await tabs[0].evaluate(()=>{const i=window.voteTimes.findIndex(x=>x.phase==='voteReview');return Math.round(window.voteTimes[i+1].time-window.voteTimes[i].time)});
 if(publicDisplayMs<4500||publicDisplayMs>5800)throw Error('Unexpected public display duration '+publicDisplayMs);
 if(errors.length)throw Error(JSON.stringify(errors));
 for(const p of tabs)await p.close();
 for(const a of auths)await post('leave',a,{});
 return {players:4,revealedCards:count,publicDisplayMs,resultHiddenDuringReview:true,revealedCardsRemovedAfterReview:true,ended:!!result,pageErrors:errors.length};
}
