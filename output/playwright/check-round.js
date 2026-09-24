async page => {
 await page.locator('.logs').getByText('검증 3 창고 교환 완료',{exact:true}).waitFor();
 await page.locator('.logs').getByText('2번째 라운드 · 행동을 선택하세요.',{exact:true}).waitFor();
 await page.screenshot({path:'output/playwright/rework-round-complete.png',fullPage:true});
 return {tradeAndStockCompleted:true,nextRound:2};
}
