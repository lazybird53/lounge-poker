async page=>{
 const tabs=page.context().pages();const p=tabs.filter(p=>p.viewportSize()?.width===390).at(-1);
 await p.screenshot({path:'output/playwright/ux-mobile-check.png',fullPage:true});
 return p.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON()})).filter(e=>e.rect.right>innerWidth+1||e.rect.left< -1).slice(0,25));
}
