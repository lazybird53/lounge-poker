async page=>{
 const base='http://localhost:3213',errors=[],other=await page.context().newPage(),checks=[];
 try{
  for(const tab of [page,other]){tab.on('pageerror',e=>errors.push(e.message));await tab.goto(base);await tab.evaluate(()=>sessionStorage.removeItem('lounge'));await tab.reload();}
  await page.getByLabel('닉네임').fill('');await page.getByRole('button',{name:'새로운 테이블 만들기'}).click();await page.getByText('닉네임을 입력해 주세요.',{exact:true}).waitFor();
  if(!await page.getByLabel('닉네임').evaluate(el=>el===document.activeElement))throw Error('Name error focus');
  await page.getByLabel('닉네임').fill('사용성 검증');await page.getByLabel('닉네임').press('Enter');
  await page.getByRole('button',{name:'방 나가기',exact:true}).waitFor();checks.push('enterCreateAndInlineValidation');
  const auth=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('lounge')));
  await other.getByLabel('닉네임').fill('친구');await other.getByLabel('초대 코드',{exact:true}).fill('12');await other.getByLabel('초대 코드',{exact:true}).press('Enter');
  await other.getByText('초대 코드 6자리를 확인해 주세요. 예: A1B2C3',{exact:true}).waitFor();
  await other.getByLabel('초대 코드',{exact:true}).fill(auth.code.slice(0,3).toLowerCase()+' '+auth.code.slice(3).toLowerCase());
  if(await other.getByLabel('초대 코드',{exact:true}).inputValue()!==auth.code)throw Error('Paste normalization');
  await other.getByLabel('초대 코드',{exact:true}).press('Enter');await other.getByRole('button',{name:'방 나가기',exact:true}).waitFor();checks.push('enterJoinSpacedCode');
  const otherAuth=await other.evaluate(()=>JSON.parse(sessionStorage.getItem('lounge')));
  await page.getByRole('button',{name:'+ 연습 봇 추가',exact:true}).focus();await page.getByRole('button',{name:'+ 연습 봇 추가',exact:true}).press('Enter');await page.waitForTimeout(250);
  if(!await page.getByRole('button',{name:'+ 연습 봇 추가',exact:true}).evaluate(el=>el===document.activeElement))throw Error('Keyboard focus lost');checks.push('keyboardFocusAfterUpdate');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.querySelector('#chatPanel').open=false);
  await other.request.post(base+'/api/action?code='+otherAuth.code,{headers:{Authorization:'Bearer '+otherAuth.token},data:{type:'chat',text:'닫힌 동안 온 메시지'}});
  await page.locator('.chat-unread').waitFor({state:'visible'});await page.getByRole('button',{name:'채팅',exact:true}).click();await page.locator('.chat-unread').waitFor({state:'hidden'});checks.push('unreadChat');
  await page.route('**/api/action?*',async route=>{if(route.request().postDataJSON()?.type==='chat')await page.waitForTimeout(650);await route.continue();});
  await page.getByLabel('전체 채팅',{exact:true}).fill('천천히 전송');await page.getByRole('button',{name:'메시지 전송'}).click();
  if(!await page.getByRole('button',{name:'메시지 전송'}).isDisabled())throw Error('No pending feedback');
  await page.getByLabel('전체 채팅',{exact:true}).fill('전송 도중 다음 메시지 작성');
  await page.waitForFunction(()=>!document.querySelector('.chat-form button').disabled);
  if(await page.getByLabel('전체 채팅',{exact:true}).inputValue()!=='전송 도중 다음 메시지 작성')throw Error('New draft cleared');checks.push('pendingFeedbackAndNextDraft');
  await page.unroute('**/api/action?*');await page.screenshot({path:'output/playwright/usability-mobile.png',fullPage:true});
  if(errors.length)throw Error(errors.join('\n'));
  await page.evaluate(result=>localStorage.setItem('usability-test',JSON.stringify(result)),{checks,errors});
 }finally{
  for(const tab of [page,other])await tab.evaluate(async()=>{const a=JSON.parse(sessionStorage.getItem('lounge'));if(a)await fetch('/api/leave?code='+a.code,{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:'{}'});sessionStorage.removeItem('lounge');});
  await other.close();await page.goto(base);
 }
}
