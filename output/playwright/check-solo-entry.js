async page => {
 await page.goto('http://localhost:3211');
 await page.evaluate(()=>sessionStorage.removeItem('lounge'));await page.reload();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('#name').fill('혼자 연습');await page.locator('#create').click();
 for(let i=0;i<3;i++){
  await page.locator('#bot').click();
  await page.waitForFunction(n=>document.querySelectorAll('.seat').length===n,i+2);
 }
 await page.locator('#start:not([disabled])').click();
 await page.locator('#rules').click();await page.locator('#help[open]').waitFor();
 await page.locator('#closeHelp').click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-action="0"]').click();
 await page.locator('#restart').waitFor({timeout:20000});
 if(!(await page.locator('.result').innerText()).includes('오리 승리'))throw Error('Duck result missing');
 await page.locator('#restart').click();
 await page.locator('[data-action="1"]:not([disabled])').waitFor();
 if(errors.length)throw Error(errors.join('\n'));
 return {entryViaUI:true,threeBots:true,helpOpenedAndClosed:true,duckButtonEnd:true,restart:true,pageErrors:0};
}
