async page=>{
 const base='http://localhost:3213',errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.evaluate(()=>sessionStorage.removeItem('lounge'));await page.reload();
 await page.setViewportSize({width:390,height:844});
 await page.getByLabel('닉네임').fill('모바일 검증');await page.getByRole('button',{name:'새로운 테이블 만들기'}).tap();
 await page.getByRole('button',{name:'음성 참가',exact:true}).waitFor();
 const auth=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('lounge')));
 const post=(body)=>page.request.post(base+'/api/action?code='+auth.code,{headers:{Authorization:'Bearer '+auth.token},data:body});
 for(let i=0;i<3;i++)await post({type:'bot'});await post({type:'start'});
 await page.getByRole('button',{name:'채팅',exact:true}).tap();
 await page.getByLabel('전체 채팅',{exact:true}).fill('한글 조합중');
 await page.getByLabel('전체 채팅',{exact:true}).evaluate(el=>{window.savedInput=el;el.setSelectionRange(2,4);el.dispatchEvent(new CompositionEvent('compositionstart'));});
 await post({type:'chat',text:'한글 중에도 게임 화면 갱신'});
 await page.getByText('한글 중에도 게임 화면 갱신',{exact:false}).waitFor();
 if(!await page.evaluate(()=>savedInput===document.querySelector('#chatInput')&&document.activeElement===savedInput&&savedInput.selectionStart===2&&savedInput.selectionEnd===4))throw Error('Composition input changed');
 await page.getByLabel('전체 채팅',{exact:true}).dispatchEvent('compositionend');checks.push('stableInputDuringGameUpdates');
 // Simulate visual viewport geometry only; this does not create an OS keyboard.
 for(const height of [440,320]){
  await page.evaluate(height=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:height});visualViewport.dispatchEvent(new Event('resize'));},height);
  await page.waitForTimeout(100);
  const geometry=await page.evaluate(()=>{
   const input=document.querySelector('#chatInput').getBoundingClientRect(),dock=document.querySelector('.voice-panel').getBoundingClientRect(),chat=document.querySelector('#chatPanel').getBoundingClientRect();
   return {input:{top:input.top,bottom:input.bottom},dock:{top:dock.top,bottom:dock.bottom},chat:{top:chat.top,bottom:chat.bottom},height:visualViewport.height};
  });
  if(geometry.input.top<0||geometry.input.bottom>geometry.dock.top||geometry.dock.bottom>height+1||geometry.chat.top<0)throw Error('Keyboard overlap '+JSON.stringify(geometry));
 }
 await page.screenshot({path:'output/playwright/mobile-keyboard-geometry.png',fullPage:true});checks.push('keyboardGeometry440and320');
 await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
 await page.getByLabel('전체 채팅',{exact:true}).press('Escape');
 for(const [width,height] of [[320,568],[390,844],[844,390],[568,320],[768,1024]]){
  await page.setViewportSize({width,height});
  await page.getByRole('button',{name:'채팅',exact:true}).tap();
  const input=await page.getByLabel('전체 채팅',{exact:true}).boundingBox();
  const mic=await page.getByRole('button',{name:'음성 참가',exact:true}).boundingBox();
  if(!input||input.y<0||input.y+input.height>height||!mic||mic.y+mic.height>height+1)throw Error('Rotation overlap '+width+'x'+height);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Overflow '+width);
  await page.getByLabel('전체 채팅',{exact:true}).press('Escape');
 }checks.push('portraitLandscapeTablet');
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{window.realMic=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});
 await page.getByRole('button',{name:'음성 참가',exact:true}).tap();await page.getByText('마이크 권한이 거절됐어요. 브라우저 권한을 확인해 주세요.').waitFor();
 if(!await page.getByRole('button',{name:'음성 참가',exact:true}).isEnabled())throw Error('No permission retry');checks.push('permissionDeniedRetry');
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.finishMic=resolve);});
 await page.getByRole('button',{name:'음성 참가',exact:true}).tap();await page.getByRole('button',{name:'참가 취소',exact:true}).tap();
 await page.evaluate(async()=>{window.lateMedia=await window.realMic({audio:true});window.finishMic(lateMedia);});
 await page.waitForFunction(()=>lateMedia.getTracks().every(t=>t.readyState==='ended'));checks.push('cancelPendingPermissionStopsLateMic');
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=window.realMic;});
 await page.getByRole('button',{name:'음성 참가',exact:true}).tap();await page.getByRole('button',{name:'마이크 끄기',exact:true}).waitFor();
 await page.getByRole('button',{name:'마이크 끄기',exact:true}).tap();await page.getByRole('button',{name:'마이크 켜기',exact:true}).waitFor();
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await page.getByRole('button',{name:'음성 참가',exact:true}).waitFor();checks.push('pagehideStopsVoice');
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 if(!await page.getByRole('button',{name:'음성 참가',exact:true}).isEnabled())throw Error('BFCache retry unavailable');
 await page.screenshot({path:'output/playwright/mobile-tested.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 await page.evaluate(result=>localStorage.setItem('mobile-test',JSON.stringify(result)),{checks,errors});
}
