async page=>{
 const root='http://localhost:3212',errors=[];
 const host=page,guest=await page.context().newPage();
 for(const p of [host,guest]){p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);await p.goto(root);}
 await host.locator('#name').fill('처음 방장');await host.locator('#create').click();await host.locator('#copy').waitFor();
 const code=await host.locator('#copy b').innerText();
 await guest.bringToFront();await guest.locator('#name').fill('다음 방장');await guest.locator('#code').fill(code);await guest.locator('#join').click();await guest.locator('#leave').waitFor();
 await host.bringToFront();for(let i=0;i<2;i++){await host.locator('#bot').click();await host.waitForFunction(n=>document.querySelectorAll('.seat').length===n,i+3);}
 await host.locator('#start').click();await host.locator('.handpanel').waitFor();
 // Test both decisions without a native modal stopping the CLI cell.
 await host.evaluate(()=>{window.confirm=message=>{window.lastConfirm=message;return false}});
 await host.locator('#leave').click();if(!(await host.locator('.handpanel').count()))throw Error('Cancelled leave changed room');
 await host.evaluate(()=>window.confirm=message=>{window.lastConfirm=message;return true});
 await host.locator('#leave').click();await host.locator('#create').waitFor();
 if((await host.locator('#name').inputValue())!=='처음 방장')throw Error('Nickname lost');
 if(!(await host.evaluate(()=>window.lastConfirm)).includes('판이 중단'))throw Error('No interruption warning');
 await guest.bringToFront();await guest.locator('#bot').waitFor();await guest.locator('.room-notice').filter({hasText:'중단'}).waitFor();
 if(await guest.locator('.handpanel').count())throw Error('Private cards persisted');
 await host.bringToFront();await host.locator('#create').click();await host.locator('#copy').waitFor();
 const newCode=await host.locator('#copy b').innerText();if(newCode===code)throw Error('New room reused old room');
 await host.locator('#leave').click();await host.locator('#code').fill(code);await host.locator('#join').click();await host.locator('#leave').waitFor();
 await guest.bringToFront();await guest.waitForFunction(()=>document.querySelectorAll('.seat').length===4);
 await guest.locator('#removeBot').click();await guest.waitForFunction(()=>document.querySelectorAll('.seat').length===3);
 if(await guest.locator('#start').isEnabled())throw Error('Started with fewer than four');
 await guest.locator('#bot').click();await guest.waitForFunction(()=>document.querySelectorAll('.seat').length===4);
 await guest.locator('#start').click();await guest.locator('.handpanel').waitFor();
 await guest.evaluate(()=>window.confirm=()=>true);await guest.locator('#backLobby').click();await guest.locator('#bot').waitFor();
 await guest.route('**/api/state?*',route=>route.abort());await guest.locator('#connectionStatus:not([hidden])').waitFor();
 await guest.unroute('**/api/state?*');await guest.locator('#connectionStatus[hidden]').waitFor({state:'attached'});
 await guest.setViewportSize({width:390,height:844});
 if(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile controls overflow');
 await guest.screenshot({path:'output/playwright/room-lobby-mobile.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 return {leaveCancelled:true,activeLeaveToLobby:true,hostTransferred:true,newRoom:true,rejoinOldRoom:true,nicknameRetained:true,botRemoveAdd:true,hostReturnToLobby:true,networkRecovery:true,pageErrors:0};
}
