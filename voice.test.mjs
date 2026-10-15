import test from 'node:test';
import assert from 'node:assert/strict';
import {voice} from './voice.mjs';
import {player,room,act} from './engine.mjs';
test('voice signals are room/session scoped, acknowledged and expire',()=>{
 const a=player('a'),b=player('b'),r=room(a);r.players.push(b);
 voice(r,a,{type:'join',session:'aa'},100);
 voice(r,b,{type:'join',session:'bb'},100);
 const data={type:'offer',sdp:'test'};
 voice(r,a,{type:'signal',session:'aa',to:b.id,targetSession:'bb',data},101);
 assert.equal(voice(r,b,{type:'poll',session:'bb'},102).messages.length,1);
 assert.equal(voice(r,b,{type:'poll',session:'bb',ack:1},103).messages.length,0);
 assert.throws(()=>voice(room(a),a,{type:'signal',session:'aa',to:b.id,targetSession:'bb',data}));
 voice(r,b,{type:'join',session:'new'},104);
 assert.throws(()=>voice(r,a,{type:'signal',session:'aa',to:b.id,targetSession:'bb',data},105));
 voice(r,b,{type:'leave',session:'bb'},106);
 assert.equal(voice(r,b,{type:'poll',session:'new'},107).peers.length,2);
 assert.throws(()=>voice(r,a,{type:'poll',session:'aa'},20000));
});
test('voice excludes departed players and rejects malformed signals',()=>{
 const a=player('a'),b=player('b'),r=room(a);r.players.push(b);
 voice(r,a,{type:'join',session:'aa'});voice(r,b,{type:'join',session:'bb'});
 assert.throws(()=>voice(r,a,{type:'signal',session:'aa',to:b.id,targetSession:'bb',data:{type:'offer'}}));
 r.players.pop();assert.equal(voice(r,a,{type:'poll',session:'aa'}).peers.length,1);
});
test('chat validates length and rate without moving the game forward',()=>{
 const a=player('a'),r=room(a);
 act(r,a,{type:'chat',text:'안녕 😀'});assert.equal(r.chat[0].text,'안녕 😀');assert.equal(r.phase,'lobby');
 assert.throws(()=>act(r,a,{type:'chat',text:'spam'}));
 for(const text of ['',{},'a'.repeat(241)])assert.throws(()=>act(r,a,{type:'chat',text}));
});
