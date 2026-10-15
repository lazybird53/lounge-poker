// Only the same snapshot a human receives. No room, hidden hands or true role.
export function botAction(s,pick){
 const candidate=s.players.find(p=>p.id===s.candidate)?.color;
 const value=c=>c==='wild'?5:c===candidate?4:c==='blank'?0:1;
 const best=(indices,hand,highest=true)=>{
  const scores=indices.map(i=>value(hand[i])),score=(highest?Math.max:Math.min)(...scores);
  return pick(indices.filter((_,i)=>scores[i]===score));
 };
 const indices=s.hand.map((_,i)=>i),others=s.players.filter(p=>p.id!==s.me);
 if(s.phase==='choose'&&s.chosen===null){
  // Practice heuristic, not a claim of optimal strategy: collect candidate cards
  // and request votes when able to contribute. Never blindly end with duck.
  const useful=s.hand.some(c=>c===candidate||c==='wild');
  return {type:'choose',action:pick(useful?[1,1,1,2,3,4]:[1,2,3,3,4,4])};
 }
 if(s.phase==='vote'&&!s.voted){
  const matching=indices.filter(i=>s.hand[i]===candidate),wild=indices.filter(i=>s.hand[i]==='wild'),blank=indices.filter(i=>s.hand[i]==='blank');
  return {type:'card',index:pick(matching.length?matching:wild.length?wild:blank.length?blank:indices)};
 }
 const t=s.task;if(!t)return null;
 if(t.kind==='trade'&&t.target&&[t.actor,t.target].includes(s.me)&&!t.submitted)return {type:'card',index:best(s.allowed,s.hand,false)};
 if(t.actor!==s.me)return null;
 if(['watch','trade','special'].includes(t.kind)&&!t.target){
  // A candidate-colour player may be forced to give their own colour in trade.
  // An actually observed useful hand takes priority; unseen hands stay unknown.
  const observed=others.find(p=>p.id===s.visible?.id&&s.visible.hand.some(c=>value(c)>=4));
  const target=t.kind==='trade'?(observed||others.find(p=>p.id===s.candidate)):
   t.kind==='special'?observed:null;
  return {type:'target',target:(target||pick(others)).id};
 }
 if(['stock','special'].includes(t.kind)){
  if(t.stage==='receive')return {type:'take',index:t.kind==='stock'?pick(Array.from({length:s.stockCount},(_,i)=>i)):best(s.visible.hand.map((_,i)=>i),s.visible.hand)};
  if(t.stage==='give')return {type:'card',index:best(s.allowed,s.hand,false)};
 }
 return null;
}
