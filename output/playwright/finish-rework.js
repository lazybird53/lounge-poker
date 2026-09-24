async page => {
 const pages=page.context().pages();
 const state=await pages[0].evaluate(async()=>{const a=JSON.parse(sessionStorage.getItem('lounge'));return (await fetch('/api/state?code='+a.code,{headers:{Authorization:'Bearer '+a.token}})).json()});
 if(state.phase==='trade')await pages[0].locator('[data-card]:not([disabled])').first().click();
 await pages[3].locator('[data-take]').first().click();
 await pages[3].locator('[data-card]:not([disabled])').first().click();
 await pages[3].locator('.logs').getByText('라운드 완료 · 손패와 결과를 확인하세요.',{exact:true}).waitFor();
 await pages[3].screenshot({path:'output/playwright/rework-round-complete.png',fullPage:true});
 return {stockCompleted:true,roundReviewVisible:true};
}
