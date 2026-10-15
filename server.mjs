import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {voice} from './voice.mjs';
import {room,player,act,view,tick,bots,leave,expireDisconnected} from './engine.mjs';
const rooms=new Map();
const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'허용되지 않은 요청이에요.'});
   let b={};if(req.method==='POST'){let chunks='',size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw Error('요청이 너무 커요.');chunks+=chunk;}b=JSON.parse(chunks||'{}');}
   if(req.method==='POST'&&['/api/create','/api/join'].includes(url.pathname)){
    let p=player(b.name),r;
    if(url.pathname==='/api/create'){if(rooms.size>=300)throw Error('방이 가득 찼어요.');r=room(p);do{r.code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(r.code));rooms.set(r.code,r);}
    else {r=rooms.get(String(b.code).trim().toUpperCase());if(!r||r.phase!=='lobby'||r.players.length>=6)throw Error('참가할 수 있는 대기실이 아니에요.');r.players.push(p);}
    r.updated=Date.now();return json(200,{code:r.code,token:p.token});
   }
   const r=rooms.get(url.searchParams.get('code'));const p=r?.players.find(x=>x.token===req.headers.authorization?.replace('Bearer ',''));if(!p)return json(401,{error:'방을 찾을 수 없어요. 새로 참가해 주세요.'});
   if(url.pathname==='/api/leave'&&req.method==='POST'){leave(r,p);if(!r.players.some(q=>!q.bot))rooms.delete(r.code);return json(200,{left:true});}
   if(url.pathname==='/api/voice'&&req.method==='POST')return json(200,{...voice(r,p,b),...(b.type==='join'?{iceServers:JSON.parse(process.env.VOICE_ICE_SERVERS||'[{"urls":"stun:stun.l.google.com:19302"}]')}:{} )});
   if(url.pathname==='/api/action'&&req.method==='POST'){p.lastSeen=Date.now();act(r,p,b);}else if(url.pathname!=='/api/state'||req.method!=='GET')return json(404,{error:'없는 요청이에요.'});
   p.lastSeen=Date.now();
   r.updated=Date.now();return json(200,view(r,p));
  }
  const files={'/':'index.html','/app.js':'app.js','/voice.js':'voice.js','/style.css':'style.css','/card-display.mjs':'card-display.mjs','/table-art.mjs':'table-art.mjs'};const file=files[url.pathname];if(!file){res.writeHead(404);return res.end('Not found');}
  const content=await readFile(new URL(`./public/${file}`,import.meta.url));
  res.writeHead(200,{'Content-Type':(file.endsWith('.js')||file.endsWith('.mjs'))?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(content);
 }catch(e){json(400,{error:e.message});}
});
// Advance deadlines independently of the practice bots' thinking cadence.
setInterval(()=>{for(const r of rooms.values())tick(r,Date.now(),false);},50).unref();
setInterval(()=>{for(const r of rooms.values()){expireDisconnected(r);if(!r.players.some(p=>!p.bot)){rooms.delete(r.code);continue;}bots(r);}},1600).unref();
setInterval(()=>{for(const [code,r] of rooms)if(Date.now()-r.updated>12*60*60*1000)rooms.delete(code);},60000).unref();
server.listen(Number(process.env.PORT||3210),'0.0.0.0',()=>console.log('라운지포커 · http://localhost:'+(process.env.PORT||3210)));
