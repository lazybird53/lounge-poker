async (page) => {
 const root='http://localhost:3211';
 const api=async(path,a,b)=>{const r=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data:b});if(!r.ok())throw Error(await r.text());return r.json()};
 const a=[await api('create',null,{name:'감시 A'})];
 for(let i=1;i<4;i++)a.push(await api('join',null,{name:'검증 '+i,code:a[0].code}));
 const pages=[page];for(let i=1;i<4;i++)pages.push(await page.context().newPage());
 for(let i=0;i<4;i++){await pages[i].goto(root);await pages[i].evaluate(v=>sessionStorage.setItem('lounge',JSON.stringify(v)),a[i]);await pages[i].reload()}
 await pages[0].locator('#start').click();
 for(let i=0;i<4;i++)await pages[i].locator('[data-action="'+(i<2?2:i===2?3:4)+'"]').click();
 await pages[0].locator('[data-target]').first().waitFor();await pages[1].locator('[data-target]').first().waitFor();
 await pages[1].locator('[data-target]').first().click();await pages[0].locator('[data-target]').first().click();
 await pages[2].locator('[data-target]').first().click();
 if(await pages[0].locator('[data-card]').count())throw Error('premature trade');
 await pages[2].locator('[data-card]:not([disabled])').first().click();
 await page.screenshot({path:'output/playwright/rework-watch-trade.png',fullPage:true});
 return {watchersCanChoose:true,earlyTradeBlocked:true,pages:pages.length};
}
