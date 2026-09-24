async page => {
 const root='http://localhost:3211',errors=[];
 const req=async(path,a,data)=>{const r=await page.request.post(root+'/api/'+path+(a?'?code='+a.code:''),{headers:a?{Authorization:'Bearer '+a.token}:{},data});if(!r.ok())throw Error(await r.text());return r.json()};
 let auths,states,recipient;
 for(let tries=0;tries<20;tries++){
  auths=[await req('create',null,{name:'거래 요청자'})];
  for(let i=1;i<4;i++)auths.push(await req('join',null,{name:'참가자 '+i,code:auths[0].code}));
  await req('action',auths[0],{type:'start'});
  states=await Promise.all(auths.map(async a=>(await page.request.get(root+'/api/state?code='+a.code,{headers:{Authorization:'Bearer '+a.token}})).json()));
  recipient=states.findIndex((s,i)=>i>0&&!s.hand.includes(i));if(recipient>0)break;
 }
 if(recipient<1)throw Error('No manual recipient found');
 const second=[1,2,3].find(i=>i!==recipient),tabs=[];
 for(const a of auths){const p=await page.context().newPage();p.on('pageerror',e=>errors.push(e.message));await p.setViewportSize({width:1280,height:720});await p.goto(root);await p.evaluate(a=>sessionStorage.setItem('lounge',JSON.stringify(a)),a);await p.reload();tabs.push(p)}
 for(let i=0;i<4;i++){await tabs[i].bringToFront();await tabs[i].locator('[data-action="'+(i===0||i===second?3:4)+'"]').click()}
 const actor=tabs[0],other=tabs[recipient];await actor.bringToFront();
 await actor.locator('.self .turn-bubble').waitFor();
 await actor.locator('.turn-bubble[aria-label="차례 대기"]').waitFor();
 await actor.screenshot({path:'output/playwright/turn-waiting-queued.png',fullPage:true});
 await actor.locator('.seat[data-target="'+states[recipient].me+'"]').click();
 await actor.locator('.table-prompt').filter({hasText:'참가자 '+recipient+'와 거래'}).waitFor();
  await actor.route('**/api/action?*',async route=>{await actor.waitForTimeout(900);await route.continue()},{times:1});
 const submit=actor.locator('[data-card]:not([disabled])').first().click();
 await actor.locator('#app[aria-busy="true"] .pending').waitFor();
 await actor.screenshot({path:'output/playwright/ux-trade-sending.png',fullPage:true});await submit;
 await actor.locator('.table-prompt strong').filter({hasText:'상대의 카드 선택 대기'}).waitFor();
 if(await actor.locator('.self .turn-bubble').count())throw Error('Sender bubble did not clear');
 await actor.locator('.self .completion').waitFor();
 await other.bringToFront();await other.locator('[data-card]').first().waitFor();
 await other.locator('.self .turn-bubble').waitFor();
 const prompt=await other.locator('.table-prompt').innerText();
 if(!prompt.includes('줄 카드를 선택하세요')||!prompt.includes('거래 요청자와 거래'))throw Error('Wrong recipient prompt: '+prompt);
 await other.setViewportSize({width:390,height:844});
 const placement=await other.evaluate(()=>({prompt:document.querySelector('.table-prompt').getBoundingClientRect().bottom,hand:document.querySelector('.handpanel').getBoundingClientRect().top}));
 if(placement.prompt>placement.hand)throw Error('Instruction appears after hand');
 if(await other.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile horizontal overflow');
 await other.screenshot({path:'output/playwright/ux-trade-reply.png',fullPage:true});
 const bubble=await other.locator('.self .turn-bubble').boundingBox();
 if(!bubble||bubble.x<0||bubble.x+bubble.width>390)throw Error('Bubble outside mobile viewport');
 await other.locator('[data-card]').first().click();
 await actor.bringToFront();await actor.locator('.self .completion').waitFor();
 if(await actor.locator('.self .turn-bubble').count())throw Error('Completed actor still thinking');
 await actor.screenshot({path:'output/playwright/ux-trade-completed.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 for(const p of tabs)await p.close();
 return {manualReply:true,queuedBubble:true,senderCheckBeforeReply:true,partnerNamedBothSides:true,mobileInstructionBeforeHand:true,pageErrors:0};
}
