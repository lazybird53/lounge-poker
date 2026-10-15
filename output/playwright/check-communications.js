async page=>{
 const context=page.context(),pages=[],errors=[];
 await context.addInitScript(()=>{if(window.testConnections)return;const Original=window.RTCPeerConnection;window.testConnections=[];window.RTCPeerConnection=class extends Original{constructor(...args){super(...args);window.testConnections.push(this);}};});
 try{
  let code;
  for(let i=0;i<6;i++){
   const tab=i===0?page:await context.newPage();pages.push(tab);tab.on('pageerror',e=>errors.push(e.message));tab.once('dialog',d=>d.accept());
   await tab.goto('http://localhost:3212');await tab.getByLabel('닉네임').fill('음성테스트'+i);
   if(i===0){await tab.getByRole('button',{name:'새로운 테이블 만들기'}).click();await tab.getByRole('button',{name:/초대 코드/}).waitFor();code=await tab.evaluate(()=>JSON.parse(sessionStorage.getItem('lounge')).code);}
   else{await tab.getByLabel('초대 코드',{exact:true}).fill(code);await tab.getByRole('button',{name:'코드로 참가하기'}).click();}
   await tab.getByRole('button',{name:'음성 참가',exact:true}).click();
   await tab.getByRole('button',{name:'마이크 끄기',exact:true}).waitFor();
  }
  for(const tab of pages)await tab.waitForFunction(()=>window.testConnections.filter(pc=>pc.connectionState==='connected').length===5,{},{timeout:30000});
  const packets=[];
  for(const tab of pages)packets.push(await tab.evaluate(async()=>{const stats=await Promise.all(window.testConnections.map(p=>p.getStats()));return stats.flatMap(s=>[...s.values()]).filter(r=>r.type==='inbound-rtp'&&r.kind==='audio').map(r=>r.packetsReceived);}));
  if(packets.some(a=>a.length!==5||a.some(n=>!n)))throw Error('Not all six peers received audio');
  await page.getByRole('button',{name:'게임 시작',exact:true}).click();
  await page.getByRole('button',{name:'감시',exact:true}).click();
  await page.getByLabel('전체 채팅',{exact:true}).fill('안녕 😀 <img src=x onerror=alert(1)>');await page.getByRole('button',{name:'메시지 전송'}).click();
  await pages[1].getByText('안녕 😀 <img src=x onerror=alert(1)>',{exact:false}).waitFor();
  await page.route('**/api/action?*',route=>route.request().postDataJSON()?.type==='chat'?route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'테스트 실패'})}):route.continue());
  await page.getByLabel('전체 채팅',{exact:true}).fill('실패해도 남는 초안');await page.getByRole('button',{name:'메시지 전송'}).click();await page.getByRole('status').filter({hasText:'채팅 전송 실패'}).waitFor();
  if(await page.getByLabel('전체 채팅',{exact:true}).inputValue()!=='실패해도 남는 초안')throw Error('Draft lost');await page.unroute('**/api/action?*');
  await page.getByRole('button',{name:'마이크 끄기',exact:true}).click();
  if(!await page.evaluate(()=>window.testConnections.every(pc=>pc.getSenders().every(s=>!s.track||!s.track.enabled))))throw Error('Mute failed');
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'마이크 켜기',exact:true}).scrollIntoViewIfNeeded();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
  await page.screenshot({path:'output/playwright/communications-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'음성 나가기',exact:true}).click();await page.getByRole('button',{name:'음성 참가',exact:true}).waitFor();
  if(!await page.evaluate(()=>window.testConnections.every(pc=>pc.connectionState==='closed')))throw Error('Peers not closed');
  await pages[1].waitForFunction(()=>window.testConnections.filter(pc=>pc.connectionState==='connected').length===4);
  if(errors.length)throw Error(errors.join('\n'));
  await page.evaluate(result=>localStorage.setItem('comms-test',JSON.stringify(result)),{sixPeerAudioPackets:packets,inGameChat:true,failedDraftPreserved:true,mute:true,leave:true,mobile:true,pageErrors:errors});
 }finally{for(const tab of pages){
  const exit=tab.getByRole('button',{name:'음성 나가기',exact:true});if(await exit.isVisible())await exit.click();
  await tab.evaluate(async()=>{const a=JSON.parse(sessionStorage.getItem('lounge'));if(a)await fetch('/api/leave?code='+a.code,{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:'{}'});sessionStorage.removeItem('lounge');});
  if(tab!==page)await tab.close();
 }await page.goto('http://localhost:3212');}
}
