async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3213');await page.evaluate(()=>sessionStorage.removeItem('lounge'));
 await page.setViewportSize({width:1440,height:900});await page.goto('http://localhost:3213');
 if(await page.getByRole('button',{name:'음성 참가',exact:true}).isVisible())throw Error('Voice visible outside room');
 await page.getByLabel('닉네임').fill('테이블지기');await page.getByRole('button',{name:'새로운 테이블 만들기'}).click();
 for(let i=0;i<5;i++){await page.getByRole('button',{name:'+ 연습 봇 추가',exact:true}).click();await page.waitForTimeout(200);}
 await page.getByRole('button',{name:'게임 시작',exact:true}).click();
 await page.screenshot({path:'output/playwright/ux-desktop.png',fullPage:true});
 for(const width of [390,360,768]){
  await page.setViewportSize({width,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow '+width);
  const mic=await page.getByRole('button',{name:'음성 참가',exact:true}).boundingBox();
  if(!mic||mic.y+mic.height>844||mic.height<44)throw Error('Mic unreachable '+width);
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>document.querySelector('#chatPanel').open=false);
 await page.screenshot({path:'output/playwright/ux-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'채팅',exact:true}).click();await page.getByLabel('전체 채팅',{exact:true}).fill('안녕하세요, 한글 입력 중');
 await page.getByLabel('전체 채팅',{exact:true}).evaluate(el=>{el.setSelectionRange(2,5);el.dispatchEvent(new CompositionEvent('compositionstart',{data:'한'}));window.imeInput=el;});
 const auth=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('lounge')));
 await page.request.post('http://localhost:3213/api/action?code='+auth.code,{headers:{Authorization:'Bearer '+auth.token},data:{type:'chat',text:'상태 갱신 확인'}});
 await page.waitForTimeout(500);
 if(!await page.evaluate(()=>window.imeInput===document.querySelector('#chatInput')))throw Error('IME replaced');
 await page.getByLabel('전체 채팅',{exact:true}).dispatchEvent('compositionend');
 if(await page.getByLabel('전체 채팅',{exact:true}).inputValue()!=='안녕하세요, 한글 입력 중')throw Error('Draft lost');
 await page.screenshot({path:'output/playwright/ux-mobile-chat.png',fullPage:true});
 await page.getByLabel('전체 채팅',{exact:true}).press('Escape');
 if(await page.evaluate(()=>document.querySelector('#chatPanel').open))throw Error('Escape failed');
 await page.evaluate(result=>localStorage.setItem('ux-test',JSON.stringify(result)),{widths:[360,390,768,1440],micReachable:true,ime:true,escape:true,pageErrors:errors});
 if(errors.length)throw Error(errors.join('\n'));
}
