// Match the original's type pass followed by its color pass on a copied list.
// Equal-color Blank/Wild ordering uses JavaScript's stable sort; the original
// runtime's equal-key order has not been independently observed.
export function orderedCards(hand){
 const type=c=>c==='blank'?1:c==='wild'?2:0;
 const color=c=>typeof c==='number'?c:-1;
 return hand.map((value,index)=>({value,index}))
  .sort((a,b)=>type(a.value)-type(b.value))
  .sort((a,b)=>color(a.value)-color(b.value));
}
