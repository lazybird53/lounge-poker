async page=>{
 const base='http://localhost:3213',context=page.context(),other=await context.newPage(),errors=[];
 try{
  for(const tab of [page,other]){
   tab.on('pageerror',e=>errors.push(e.message));
   await tab.goto(base);await tab.evaluate(()=>sessionStorage.removeItem('lounge'));await tab.reload();
   await tab.evaluate(()=>{window.peerList=[];const Original=window.RTCPeerConnection;window.RTCPeerConnection=class extends Original{constructor(...args){super(...args);peerList.push(this);}};});
  }
  await page.getByLabel('닉네임').fill('모바일 A');await page.getByRole('button',{name:'새로운 테이블 만들기'}).tap();
  const a=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('lounge')));
  await other.getByLabel('닉네임').fill('모바일 B');await other.getByLabel('초대 코드',{exact:true}).fill(a.code);await other.getByRole('button',{name:'코드로 참가하기'}).tap();
  for(const tab of [page,other])await tab.getByRole('button',{name:'음성 참가',exact:true}).tap();
  for(const tab of [page,other])await tab.waitForFunction(()=>peerList.some(pc=>pc.connectionState==='connected'));
  const packets=async tab=>tab.evaluate(async()=>{const stats=await peerList.at(-1).getStats();return [...stats.values()].filter(s=>s.type==='inbound-rtp'&&s.kind==='audio').reduce((sum,s)=>sum+s.packetsReceived,0);});
  const before=await packets(page);
  await page.setViewportSize({width:844,height:390});await other.bringToFront();await page.bringToFront();
  await page.getByRole('button',{name:'채팅',exact:true}).tap();await page.getByLabel('전체 채팅',{exact:true}).fill('음성 중 채팅');await page.getByRole('button',{name:'메시지 전송'}).tap();
  await page.waitForTimeout(400);const after=await packets(page);if(after<=before)throw Error('Audio stopped on rotate/chat');
  await page.route('**/api/voice?*',route=>route.request().postDataJSON()?.type==='poll'?route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'expired'})}):route.continue());
  await page.getByRole('button',{name:'음성 참가',exact:true}).waitFor();
  if(!await page.evaluate(()=>peerList.every(pc=>pc.connectionState==='closed')))throw Error('Failed voice peers not closed');
  await page.unroute('**/api/voice?*');await page.getByRole('button',{name:'음성 참가',exact:true}).tap();
  await page.waitForFunction(()=>peerList.at(-1).connectionState==='connected');
  if(errors.length)throw Error(errors.join('\n'));
  await page.evaluate(result=>localStorage.setItem('mobile-voice-test',JSON.stringify(result)),{before,after,rotateAndChatAudio:true,expiredSessionRetry:true,errors});
 }finally{
  for(const tab of [page,other]){
   const exit=tab.getByRole('button',{name:'음성 나가기',exact:true});if(await exit.isVisible())await exit.tap();
   await tab.evaluate(async()=>{const a=JSON.parse(sessionStorage.getItem('lounge'));if(a)await fetch('/api/leave?code='+a.code,{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:'{}'});sessionStorage.removeItem('lounge');});
  }
  await other.close();await page.goto(base);
 }
}
