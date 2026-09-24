import {orderedCards} from './card-display.mjs';
import {gooseArt,actionArt} from './table-art.mjs';
const $=s=>document.querySelector(s),app=$('#app');
const names=['코랄','민트','라벤더','골드','블루','로즈'],hues=['#e99f86','#a1d3b8','#bbb0e2','#e4ca80','#92bedc','#da9eb9'];
const labels=['오리','투표','감시','거래','창고'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let auth=JSON.parse(sessionStorage.getItem('lounge')||'null'),state=null,last='',busy=false,refreshing=false,stateEpoch=0;
const toast=m=>{let t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.style.display='none',3500);};
async function api(path,b){let res=await fetch('/api/'+path+(auth?'?code='+auth.code:''),{method:b?'POST':'GET',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth.token}:{})},...(b?{body:JSON.stringify(b)}:{})});let d=await res.json();if(!res.ok){const error=Error(d.error);error.status=res.status;throw error;}return d;}
function connectionWarning(show){const el=$('#connectionStatus');if(el)el.hidden=!show;}
function returnHome(){stateEpoch++;auth=null;state=null;last='';sessionStorage.removeItem('lounge');connectionWarning(false);landing();window.scrollTo?.(0,0);}
async function leaveRoom(){
 if(busy||!auth)return;
 if(state&&!['lobby','ended'].includes(state.phase)&&!confirm('방을 나가면 진행 중인 판이 중단되고 다른 참가자들은 대기실로 돌아갑니다. 나갈까요?'))return;
 busy=true;stateEpoch++;
 try{await api('leave',{});returnHome();}
 catch(e){if(e.status===401)returnHome();else toast('퇴장 요청에 실패했어요. 연결을 확인하고 다시 눌러 주세요.');}
 finally{busy=false;}
}
const card=(c,i,click=false,disabled=false,which='card')=>`<${click?'button':'div'} class="card ${c==='wild'?'wild':c==='blank'?'blank':''}" style="--c:${hues[c]||'#bdc6b2'}" ${click?`data-${which}="${i}" ${disabled?'disabled':''} aria-label="${c==='wild'?'무지개':c==='blank'?'빈 카드':names[c]} 카드 ${i+1}번"`:''}><small>${c==='wild'?'무지개':c==='blank'?'빈 카드':esc(names[c])}</small>${c==='blank'?'<div class="blank-art" aria-hidden="true"></div>':gooseArt(c==='wild'?'#fbf1bc':hues[c])}<small>${c==='wild'?'모든 색 +1':c==='blank'?'무효표':'지목 카드'}</small></${click?'button':'div'}>`;
function landing(){app.innerHTML=`<section class="landing"><div><small>친구들과 함께하는 추리 카드게임</small><h1>라운지포커</h1><p class="lead">카드를 교환하고, 한 사람의 정체를 밝혀내세요.</p><div class="hero-cards">${card(0,0)}${card('wild',0)}${card(2,0)}</div><div class="badges"><span>4–6명</span><span>비밀 손패</span><span>실시간 멀티플레이</span></div></div><section class="entry"><h2>테이블에 참가하기</h2><label for="name">닉네임</label><input id="name" value="${esc(sessionStorage.getItem('lounge-name')||'')}" maxlength="16" placeholder="테이블에서 불릴 이름" autocomplete="nickname"><button class="primary" id="create">새로운 테이블 만들기</button><div class="divider">또는 초대받은 테이블에 합류</div><label for="code">초대 코드</label><input id="code" maxlength="6" placeholder="6자리 코드" style="text-transform:uppercase"><button id="join">코드로 참가하기</button><p class="note">혼자라면 방을 만든 뒤 연습 봇을 추가해 보세요.<br>친구에게는 서버 접속 주소와 방 코드를 함께 알려 주세요.</p></section></section><footer>구구덕 라운지 카드게임 기반 · 비공식 웹 버전</footer>`;
 for(const type of ['create','join'])$('#'+type).onclick=async()=>{
  if(busy)return;if(!$('#name').value.trim())return toast('닉네임을 입력해 주세요.');busy=true;
  $('#create').disabled=true;$('#join').disabled=true;
  try{sessionStorage.setItem('lounge-name',$('#name').value.trim());auth=await api(type,{name:$('#name').value,code:$('#code').value});sessionStorage.setItem('lounge',JSON.stringify(auth));busy=false;await refresh();window.scrollTo?.(0,0);}
  catch(e){toast(e.message);}
  finally{busy=false;if($('#create'))$('#create').disabled=false;if($('#join'))$('#join').disabled=false;}
 };
}
async function send(b){
 if(busy)return;busy=true;
 app.setAttribute?.('aria-busy','true');
 const selected={choose:['action',b.action],target:['target',b.target],take:['take',b.index],card:['card',b.index]}[b.type];
 if(selected)document.querySelectorAll(`[data-${selected[0]}]`).forEach(el=>{if(el.dataset[selected[0]]===String(selected[1]))el.classList.add('pending');});
 const epoch=++stateEpoch,session=auth;
 if(['choose','target','take','card'].includes(b.type))b={...b,gameId:state?.gameId,round:state?.round};
 try{const next=await api('action',b);if(epoch!==stateEpoch||session!==auth)return;connectionWarning(false);state=next;last='';render();if(['start','lobby'].includes(b.type))window.scrollTo?.(0,0);}
 catch(e){if(epoch===stateEpoch&&session===auth)toast(e.message);}
 finally{busy=false;app.setAttribute?.('aria-busy','false');document.querySelectorAll('.pending').forEach(el=>el.classList.remove('pending'));}
}
const person=id=>state.players.find(p=>p.id===id)?.name||'플레이어';
function render(){
 const s=state;if(!s)return;const sig=JSON.stringify(s);if(sig===last)return;last=sig;
 const draft=$('#chatInput')?.value||'',focus=document.activeElement?.id==='chatInput';
 const chatOpen=$('#chatPanel')?.open,logOpen=$('#logPanel')?.open;
 const t=s.task,mine=!!t&&t.actor===s.me,active=!['lobby','ended'].includes(s.phase);
 const targeting=mine&&['watch','trade','special'].includes(s.phase)&&!t.target;
 const trading=s.phase==='trade'&&t?.target&&[t.actor,t.target].includes(s.me);
 const selectable=(s.phase==='vote'&&!s.voted)||(trading&&!t.submitted)||(mine&&['stock','special'].includes(s.phase)&&t.stage==='give');
 const force=s.phase!=='vote',specialPanel=mine&&s.phase==='special'&&t.stage==='receive'&&s.visible;
 const myColor=s.players.find(p=>p.id===s.me)?.color,ownRequired=force&&s.hand.includes(myColor);
 const tradePartner=trading?person(t.actor===s.me?t.target:t.actor):null;
 const stockPanel=mine&&s.phase==='stock'&&t.stage==='receive';
 const watch=s.visible&&!specialPanel?s.visible:null;
 const current={vote:1,voteReview:1,special:1,watch:2,trade:3,stock:4}[s.phase];
 let prompt='다른 플레이어를 기다리는 중',hint='';
 if(s.phase==='lobby'){prompt='친구를 초대하세요';hint='4–6명이 모이면 시작할 수 있어요.';}
 else if(s.phase==='choose'){prompt=s.chosen===null?'행동을 선택하세요':'다른 플레이어를 기다리는 중';hint=s.chosen===null?'가운데 칩을 눌러 선택':'내 선택: '+labels[s.chosen];}
 else if(s.phase==='reveal'){prompt='모두의 행동 공개';hint='칩 아래의 색 점을 확인하세요';}
 else if(s.phase==='review'){prompt='다음 라운드로 전환 중';hint='';}
 else if(s.phase==='voteReview'){prompt='투표 카드 공개';hint='판정 대기 중';}
 else if(s.phase==='ended'){prompt='게임 종료';}
 else if(targeting){prompt=(s.phase==='watch'?'감시할':s.phase==='trade'?'거래할':'교환할')+' 상대를 선택하세요';hint='테이블의 초상을 눌러 선택';}
 else if(stockPanel||specialPanel){prompt='받을 카드를 선택하세요';hint=stockPanel?'창고의 뒷면에서 한 장':'상대의 앞면에서 한 장';}
 else if(selectable){prompt=s.phase==='vote'?'투표할 카드를 선택하세요':ownRequired?'내 색 카드를 선택하세요':'줄 카드를 선택하세요';hint=s.phase==='vote'?'투표한 카드는 손패에 남아요':trading?tradePartner+'와 거래 · 내 손패에서 한 장':s.phase==='stock'?'창고에 넣을 카드 한 장':person(t.target)+'에게 줄 카드 한 장';}
 else if(trading){prompt='상대의 카드 선택 대기';hint=tradePartner+'의 응답을 기다려요';}
 else if(s.phase==='vote'){prompt='다른 사람의 투표 대기';hint='내 투표 완료';}
 else if(t){hint=person(t.actor)+' · '+labels[current];}
 if(s.voteResult){
  const votes=Object.values(s.voteResult),counts=s.players.map(p=>votes.filter(c=>c===p.color||c==='wild').length),maximum=Math.max(...counts);
  const elected=maximum>=s.players.length-1?s.players[counts.indexOf(maximum)]:null;
  prompt=elected?person(elected.id)+' 선출':'모두 안전합니다';
  hint=elected?maximum+'표 · 결과 확인 중':'기준표가 모이지 않았어요. 남은 행동을 진행합니다.';
 }
 const seats=[...s.players.filter(p=>p.id!==s.me),...s.players.filter(p=>p.id===s.me)];
 let stage=s.result?`<div class="stage-panel box result"><small>게임 종료</small><h2>${esc(s.result.winner)}의 승리입니다</h2><div class="winner-lineup" aria-label="승리한 참가자">${s.players.filter(p=>s.result.winner==='오리'?p.id===s.result.duck:p.id!==s.result.duck).map(p=>`<figure>${gooseArt(hues[p.color])}<figcaption>${esc(p.name)}</figcaption></figure>`).join('')}</div><p>실제 오리: ${esc(person(s.result.duck))}<br>${esc(s.result.reason)}</p>${s.host===s.me?'<button class="primary" id="restart">같은 멤버로 다시 시작</button>':'방장이 다음 게임을 시작할 수 있어요.'}</div>`:stockPanel?`<div class="stage-panel"><div class="section-label">창고 · 받을 카드 선택</div><div class="cards">${Array.from({length:s.stockCount},(_,i)=>`<button class="card back" data-take="${i}" aria-label="창고 뒷면 ${i+1}번"><small>창고</small><b>◇</b><small>${i+1}</small></button>`).join('')}</div></div>`:specialPanel?`<div class="stage-panel visible"><div class="section-label">${esc(s.visible.name)} · 받을 카드 선택</div><div class="cards">${orderedCards(s.visible.hand).map(({value:c,index:i})=>card(c,i,true,false,'take')).join('')}</div></div>`:'';

 if(!stage&&watch)stage=`<div class="stage-panel visible surveillance"><div class="section-label">감시 · ${esc(watch.name)} <span>관찰 전용</span></div><div class="cards">${orderedCards(watch.hand).map(({value:c,index:i})=>card(c,i)).join('')}</div></div>`;
 app.innerHTML=`<div class="topline"><h2>라운지포커 <small>${s.phase==='lobby'?'대기실':`ROUND ${String(s.round).padStart(2,'0')}`}</small></h2><div class="room-controls"><button class="pill" id="copy">초대 코드 <b>${esc(s.code)}</b> ⧉</button>${s.host===s.me&&s.phase!=='lobby'?'<button id="backLobby">대기실로</button>':''}<button id="leave">방 나가기</button></div></div>${s.notice?`<p class="room-notice" role="status">${esc(s.notice)}</p>`:''}<div class="layout"><section><div class="table" data-phase="${s.phase}" data-players="${s.players.length}">
 <div class="seats">${seats.map(p=>{const pick=targeting&&p.id!==s.me,tag=pick?'button':'div';return `<${tag} class="seat ${p.id===s.me?'self':''} ${p.id===s.candidate?'candidate':''} ${t?.target===p.id&&mine?'targeted':''} ${p.connected===false?'disconnected':''}" ${pick?`data-target="${p.id}" aria-label="${esc(p.name)} 선택"`:''} title="${esc(p.name)} · ${names[p.color]}${p.id===s.candidate?' · 나만의 후보':''}">${p.connected===false?'<span class="connection-label">연결 확인 중</span>':''}${s.voteResult?`<div class="vote-card" aria-label="${esc(p.name)}의 공개 투표">${card(s.voteResult[p.id],0)}</div>`:''}${p.thinking||p.queued?`<span class="turn-bubble" role="img" aria-label="${p.thinking?'선택 중':'차례 대기'}" title="${p.thinking?'선택 중':'차례 대기'}">${p.thinking?'<i></i><i></i><i></i>':''}</span>`:''}${p.completed?'<span class="completion" aria-label="이번 행동 완료">✓</span>':''}<div class="avatar" style="--c:${hues[p.color]}">${gooseArt(hues[p.color])}</div><strong>${esc(p.name)}${p.id===s.me?' · 나':''}${p.id===s.host?' · 방장':''}</strong><em>${p.id===s.candidate?'내 후보 · ':''}${names[p.color]}</em><em>${s.phase==='choose'?(p.ready?'선택 완료':'선택 중'):p.action!=null?labels[p.action]:p.bot?'연습 봇':'착석 완료'}</em></${tag}>`;}).join('')}</div>
 <div class="table-center" ${stage?'hidden':''}><h2>${s.phase==='lobby'?'테이블 준비':'행동 선택'}</h2>${s.phase==='lobby'?`<p>${s.players.length} / 6명</p><div class="lobby-actions">${s.me===s.host?`<button id="bot" ${s.players.length>=6?'disabled':''}>+ 연습 봇 추가</button><button id="removeBot" ${s.players.some(p=>p.bot)?'':'disabled'}>− 봇 제거</button><button class="primary" id="start" ${s.players.length<4?'disabled':''}>게임 시작</button>`:'방장이 시작하면 게임이 열려요.'}</div>`:active?`<div class="actionbar">${labels.map((v,i)=>`<button class="action ${s.chosen===i?'selected':''} ${current===i?'resolving':''}" data-action="${i}" ${current===i?'aria-current="step"':''} title="${['오리 승리로 게임 종료','혼자 선택하면 교환, 둘 이상이면 전체 투표','상대 손패 관찰','서로 한 장 교환','창고와 한 장 교환'][i]}" ${s.phase!=='choose'||s.chosen!==null?'disabled':''}><span>${actionArt[i]}</span>${v}<div class="selection-dots">${s.players.filter(p=>p.action===i).map(p=>`<i style="--dot:${hues[p.color]}" title="${esc(p.name)}" aria-label="${esc(p.name)}"></i>`).join('')}</div></button>`).join('')}</div>`:''}</div>
 ${stage}
 ${active?`<div class="handpanel"><div class="section-label">나의 손패 <span>${selectable?'카드를 눌러 제출':'나에게만 공개'} · ${s.hand.length}장</span></div><div class="cards">${orderedCards(s.hand).map(({value:c,index:i})=>card(c,i,!!selectable,force&&!s.allowed.includes(i))).join('')}</div></div>`:''}
 <div class="table-prompt" role="status" aria-live="polite" aria-atomic="true"><strong>${esc(prompt)}</strong><small>${esc(hint)}</small></div></div></section>
 <aside class="sidebar"><details class="box" id="chatPanel" ${chatOpen?'open':''}><summary>테이블 대화 · 전체 공개 ${s.chat.length?`(${s.chat.length})`:''}</summary><div class="chatlog">${s.chat.map(c=>`<p><b>${esc(c.name)}</b>${esc(c.text)}</p>`).join('')||'<p>이곳의 대화는 모두에게 보여요.</p>'}</div><form class="chat-form"><input id="chatInput" maxlength="240" aria-label="전체 채팅" placeholder="모두에게 한마디…" value="${esc(draft)}"><button aria-label="메시지 전송">↑</button></form></details><details class="box" id="logPanel" ${logOpen?'open':''}><summary>진행 기록</summary><div class="logs">${s.log.slice().reverse().map(l=>`<p>${esc(l)}</p>`).join('')}</div></details></aside></div>`;
 $('.table-prompt')?.setAttribute?.('role','status');
 $('.table-prompt')?.setAttribute?.('aria-live','polite');
 $('.result')?.setAttribute?.('role','alert');
 $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(s.code);toast('초대 코드를 복사했어요.');}catch{toast('초대 코드: '+s.code);}};
 for(const id of ['start','restart'])if($('#'+id))$('#'+id).onclick=()=>send({type:'start'});
 if($('#bot'))$('#bot').onclick=()=>send({type:'bot'});
 if($('#removeBot'))$('#removeBot').onclick=()=>send({type:'removeBot'});
 if($('#leave'))$('#leave').onclick=leaveRoom;
 if($('#backLobby'))$('#backLobby').onclick=()=>{if(['lobby','ended'].includes(s.phase)||confirm('진행 중인 판과 손패를 초기화하고 모두 대기실로 돌아갈까요?'))send({type:'lobby'});};
 document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{const a=Number(el.dataset.action);if(a===0&&!confirm('누가 선택하든 오리가 승리합니다. 오리 버튼을 확정할까요?'))return;send({type:'choose',action:a});});
 document.querySelectorAll('[data-target]').forEach(el=>el.onclick=()=>send({type:'target',target:el.dataset.target}));
 document.querySelectorAll('[data-take]').forEach(el=>el.onclick=()=>send({type:'take',index:Number(el.dataset.take)}));
 document.querySelectorAll('[data-card]').forEach(el=>el.onclick=()=>send({type:'card',index:Number(el.dataset.card)}));
 $('.chat-form').onsubmit=e=>{e.preventDefault();const text=$('#chatInput').value;$('#chatInput').value='';send({type:'chat',text});};
 $('.chatlog').scrollTop=99999;if(focus){$('#chatInput').focus();$('#chatInput').setSelectionRange(draft.length,draft.length);}
}
async function refresh(){
 if(!auth||busy||refreshing)return;
 refreshing=true;const epoch=stateEpoch,session=auth;
 try{const next=await api('state');if(epoch!==stateEpoch||session!==auth)return;connectionWarning(false);state=next;render();}
 catch(e){if(epoch!==stateEpoch||session!==auth)return;if(e.status===401||e.message.includes('방을 찾을')){returnHome();toast('방이 종료되었거나 퇴장 처리됐어요. 새 방을 만들거나 다시 참가해 주세요.');}else connectionWarning(true);}
 finally{refreshing=false;}
}
$('#help').setAttribute?.('aria-labelledby','helpTitle');$('#help h2').id='helpTitle';$('#closeHelp').setAttribute?.('aria-label','플레이 안내 닫기');$('#toast').setAttribute?.('aria-live','polite');
$('#rules').onclick=()=>$('#help').showModal();$('#closeHelp').onclick=()=>$('#help').close();
// Keep the existing single-in-flight guard; reduce remote action display latency.
if(auth)refresh();else landing();setInterval(()=>{if(!busy)refresh();},200);
