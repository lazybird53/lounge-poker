// Room-scoped signalling only. Audio travels through WebRTC, never this server.
const sessions=new WeakMap();
export function voice(r,p,b,now=Date.now()){
 let members=sessions.get(r);if(!members){members=new Map();sessions.set(r,members);}
 for(const [id,s] of members)if(now-s.seen>15000||!r.players.some(q=>q.id===id))members.delete(id);
 if(typeof b.session!=='string'||! /^[a-zA-Z0-9-]{1,64}$/.test(b.session))throw Error('잘못된 음성 세션이에요.');
 let s=members.get(p.id);
 if(b.type==='join'){
  if(!s||s.session!==b.session){s={session:b.session,seen:now,messages:[],seq:0,count:0,window:now};members.set(p.id,s);}
 }else if(b.type==='leave'){
  if(s?.session===b.session)members.delete(p.id);return {left:true};
 }else if(!s||s.session!==b.session)throw Error('음성에 다시 참가해 주세요.');
 s.seen=now;
 if(b.type==='signal'){
  if(now-s.window>1000){s.count=0;s.window=now;}if(++s.count>80)throw Error('음성 요청이 너무 많아요.');
  const target=members.get(b.to);
  if(!target||target.session!==b.targetSession||b.to===p.id)throw Error('음성 상대가 나갔어요.');
  const d=b.data;
  if(!d||!['offer','answer','candidate'].includes(d.type)||JSON.stringify(d).length>7000)throw Error('잘못된 음성 신호예요.');
  if(d.type==='candidate'?typeof d.candidate?.candidate!=='string':typeof d.sdp!=='string')throw Error('잘못된 음성 신호예요.');
  if(target.messages.length>=128)throw Error('음성 연결이 지연되고 있어요. 다시 참가해 주세요.');
  target.messages.push({id:++target.seq,from:p.id,session:s.session,data:d});return {ok:true};
 }
 if(!['join','poll'].includes(b.type))throw Error('없는 음성 요청이에요.');
 if(Number.isSafeInteger(b.ack))s.messages=s.messages.filter(m=>m.id>b.ack);
 s.muted=b.muted===true;
 return {me:p.id,peers:[...members].map(([id,v])=>({id,session:v.session,muted:v.muted,name:r.players.find(q=>q.id===id)?.name})),messages:s.messages};
}
