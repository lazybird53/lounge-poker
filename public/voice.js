export function createVoice(api,toast){
 const panel=document.createElement('section');panel.className='voice-panel box';panel.hidden=true;
 panel.innerHTML='<strong>테이블 음성 · 전체 공개</strong><p class="voice-status" role="status">참가할 때만 마이크를 사용해요. 헤드폰을 권장해요.</p><div class="voice-controls"><button type="button" data-voice="join">음성 참가</button><button type="button" data-voice="mute" hidden>마이크 끄기</button><button type="button" data-voice="leave" hidden>음성 나가기</button><button type="button" data-voice="play" hidden>소리 재생 허용</button></div><p class="voice-peers"></p><small>녹음하지 않아요. 연결을 위해 Google STUN을 사용하며, 참가자 간 네트워크 주소가 공유될 수 있어요.</small>';
 const chatToggle=document.createElement('button');chatToggle.type='button';chatToggle.dataset.voice='chat';chatToggle.textContent='채팅';chatToggle.setAttribute('aria-controls','chatPanel');
 chatToggle.setAttribute('aria-label','채팅');const badge=document.createElement('span');badge.className='chat-unread';badge.textContent='새 메시지';badge.hidden=true;chatToggle.append(badge);
 panel.querySelector('.voice-controls').prepend(chatToggle);
 chatToggle.onclick=()=>{const chat=document.querySelector('#chatPanel');if(!chat)return;chat.open=!chat.open;chatToggle.setAttribute('aria-expanded',String(chat.open));if(chat.open)document.querySelector('#chatInput').focus({preventScroll:true});};
 const info=document.createElement('details');info.className='voice-info';const summary=document.createElement('summary');summary.textContent='음성 안내';info.append(summary,panel.querySelector('.voice-peers'),panel.querySelector('small'));panel.append(info);
 document.querySelector('#app').after(panel);
 // The visual viewport shrinks above a software keyboard on mobile browsers.
 // Use its bottom edge and the measured dock height instead of a fixed guess.
 const updateViewport=()=>{
  const viewport=window.visualViewport,root=document.documentElement;
  const inset=viewport&&viewport.scale===1?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
  root.style.setProperty('--keyboard-inset',inset+'px');
  root.toggleAttribute('data-keyboard',inset>80);
  root.style.setProperty('--view-height',(viewport?.height||window.innerHeight)+'px');
  if(!panel.hidden)root.style.setProperty('--dock-height',panel.offsetHeight+'px');
 };
 window.visualViewport?.addEventListener('resize',updateViewport);
 window.visualViewport?.addEventListener('scroll',updateViewport);
 window.addEventListener('resize',updateViewport);
 if(window.ResizeObserver)new ResizeObserver(updateViewport).observe(panel);
 const button=n=>panel.querySelector(`[data-voice="${n}"]`),status=panel.querySelector('.voice-status'),roster=panel.querySelector('.voice-peers');
 let stream=null,session=null,room=null,timer=null,ack=0,muted=false,generation=0,iceServers=[],me=null;
 const peers=new Map();
 function close(id){const peer=peers.get(id);if(!peer)return;peer.pc.close();peer.audio.srcObject=null;peer.audio.remove();peers.delete(id);}
 function stop(notify=true){
  const old=session;generation++;session=null;clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null;
  for(const id of peers.keys())close(id);
  button('join').hidden=false;button('join').disabled=false;button('mute').hidden=true;button('leave').hidden=true;button('play').hidden=true;roster.textContent='';
  button('leave').textContent='음성 나가기';button('join').removeAttribute('aria-busy');
  status.textContent='음성에서 나왔어요. 마이크가 꺼져 있어요.';
  if(old&&notify)api('voice',{type:'leave',session:old}).catch(()=>{});
 }
 function signal(id,peer,data){return api('voice',{type:'signal',session,to:id,targetSession:peer.session,data});}
 function makePeer(info){
  const pc=new RTCPeerConnection({iceServers}),audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');panel.append(audio);
  const peer={pc,audio,session:info.session,candidates:[]};peers.set(info.id,peer);
  stream.getTracks().forEach(track=>pc.addTrack(track,stream));
  pc.onicecandidate=e=>{if(e.candidate&&session)signal(info.id,peer,{type:'candidate',candidate:e.candidate.toJSON()}).catch(()=>{status.textContent='음성 연결 실패. 나갔다 다시 참가해 주세요.';});};
  pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{button('play').hidden=false;});};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')status.textContent='연결 실패: 음성 재참가를 시도해 주세요. 외부망에서는 TURN 중계가 필요할 수 있어요.';};
  return peer;
 }
 async function poll(gen){
  if(gen!==generation||!session)return;
  try{
   const data=await api('voice',{type:'poll',session,ack,muted});if(gen!==generation)return;
   roster.textContent=data.peers.map(p=>`${p.name}${p.muted?' (마이크 꺼짐)':''}`).join(' · ');
   for(const [id,peer] of peers)if(!data.peers.some(p=>p.id===id&&p.session===peer.session))close(id);
   for(const info of data.peers){
    if(info.id===me||peers.has(info.id))continue;
    const peer=makePeer(info);
    if(me<info.id){await peer.pc.setLocalDescription(await peer.pc.createOffer());if(gen!==generation)return;await signal(info.id,peer,{type:'offer',sdp:peer.pc.localDescription.sdp});}
   }
   for(const message of data.messages){
    if(gen!==generation)return;
    if(message.id<=ack)continue;
    const peer=peers.get(message.from),d=message.data;
    if(peer&&peer.session===message.session){
     if(d.type==='candidate'){
      if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(d.candidate);else peer.candidates.push(d.candidate);
     }else{
      await peer.pc.setRemoteDescription(d);
      for(const candidate of peer.candidates)await peer.pc.addIceCandidate(candidate);peer.candidates=[];
      if(d.type==='offer'){await peer.pc.setLocalDescription(await peer.pc.createAnswer());if(gen!==generation)return;await signal(message.from,peer,{type:'answer',sdp:peer.pc.localDescription.sdp});}
     }
    }
    ack=message.id;
   }
  }catch(e){if(gen===generation){stop();status.textContent='음성 연결이 끊겼어요. 다시 참가해 주세요.';return;}}
  if(gen===generation)timer=setTimeout(()=>poll(gen),700);
 }
 button('join').onclick=async()=>{
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)return toast('음성은 HTTPS 또는 이 컴퓨터의 localhost에서 사용할 수 있어요.');
  const gen=++generation;button('join').disabled=true;button('join').setAttribute('aria-busy','true');button('leave').hidden=false;button('leave').textContent='참가 취소';status.textContent='마이크 사용 권한을 기다리는 중…';
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(gen!==generation){media.getTracks().forEach(t=>t.stop());return;}
   stream=media;session=crypto.randomUUID();ack=0;muted=false;
   const data=await api('voice',{type:'join',session,muted});if(gen!==generation)return;
   iceServers=data.iceServers;me=data.me;
   button('join').hidden=true;button('join').removeAttribute('aria-busy');button('mute').hidden=false;button('leave').hidden=false;button('leave').textContent='음성 나가기';button('mute').textContent='마이크 끄기';button('mute').setAttribute('aria-pressed','false');
   status.textContent='음성 참가 중 · 마이크 켜짐';
   stream.getAudioTracks()[0].onended=()=>stop();poll(gen);
  }catch(e){if(gen===generation){stop();status.textContent=e.name==='NotAllowedError'?'마이크 권한이 거절됐어요. 브라우저 권한을 확인해 주세요.':'마이크 또는 음성 서버에 연결하지 못했어요.';}}
 };
 button('mute').onclick=()=>{muted=!muted;stream?.getAudioTracks().forEach(t=>t.enabled=!muted);button('mute').textContent=muted?'마이크 켜기':'마이크 끄기';button('mute').setAttribute('aria-pressed',String(muted));status.textContent=muted?'마이크 꺼짐 · 듣기만 하는 중':'음성 참가 중 · 마이크 켜짐';};
 button('leave').onclick=()=>stop();
 button('play').onclick=async()=>{try{await Promise.all([...peers.values()].map(p=>p.audio.play()));button('play').hidden=true;}catch{toast('브라우저의 소리 재생 권한을 확인해 주세요.');}};
 window.addEventListener('pagehide',()=>stop());
 window.addEventListener('pageshow',()=>{updateViewport();});
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&stream){
   if(stream.getAudioTracks().some(t=>t.readyState==='ended'))stop();
   else for(const peer of peers.values())if(peer.audio.srcObject)peer.audio.play().catch(()=>{button('play').hidden=false;});
  }
 });
 return {
  sync(code){if(code!==room){stop(false);room=code;if(code)status.textContent='음성 참가를 누르면 마이크를 사용할 수 있어요.';}panel.hidden=!code;updateViewport();},
  chat(unread,open){badge.hidden=!unread;chatToggle.setAttribute('aria-expanded',String(open));chatToggle.title=unread?'새 메시지가 있어요':'테이블 대화 열기/닫기';},
  stop
 };
}
