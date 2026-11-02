import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {parseDirt,parseEts} from '../bridge/adapters.mjs';
import {createHandler,privateAddress} from '../bridge/server.mjs';
import {localEndpoint} from '../web/connection.js';

test('Wi-Fi IP entry validates addresses, ports and rejects injected URLs',()=>{
 assert.equal(localEndpoint('192.168.1.20','8787'),'http://192.168.1.20:8787');
 assert.equal(localEndpoint('10.0.0.2','9000'),'http://10.0.0.2:9000');
 for(const ip of ['8.8.8.8','192.168.1.999','192.168.1.2/evil','example.com','192.168.1.2@evil.com'])assert.throws(()=>localEndpoint(ip));
 for(const port of ['0','65536','8787/foo','abc'])assert.throws(()=>localEndpoint('192.168.1.2',port));
 assert.equal(privateAddress('::ffff:192.168.1.20'),true);
 assert.equal(privateAddress('172.31.0.1'),true);assert.equal(privateAddress('172.32.0.1'),false);
});

test('Opt-in Wi-Fi connects without token only on private host, same-origin client and private peer',async()=>{
 const server=http.createServer(createHandler({token:'test-token-123456789',lan:true,addresses:['192.168.1.20'],getSample:g=>({game:g,receivedAt:Date.now()})}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const endpoint=`${base}/api/telemetry?game=ets2`;
  assert.equal((await fetch(endpoint)).status,401);
  const headers={'X-Apex-Client':'dashboard'};
  const r=await fetch(endpoint,{headers});assert.equal(r.status,200);assert.equal((await r.json()).sample.game,'ets2');
  assert.equal((await fetch(endpoint,{headers:{...headers,'Sec-Fetch-Site':'cross-site'}})).status,401);
  const publicHostStatus=await new Promise((resolve,reject)=>{http.get(endpoint,{headers:{...headers,Host:'public-tunnel.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
  assert.equal(publicHostStatus,401);
  assert.equal((await fetch(endpoint,{headers:{...headers,Origin:'https://foreign.example'}})).status,403);
  const info=await (await fetch(`${base}/api/info`)).json();assert.equal(info.lanAccess,true);assert.deepEqual(info.addresses,['192.168.1.20']);
  assert.match(await (await fetch(base)).text(),/meta name="apex-bridge"/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('DiRT packet converts units and preserves FL/FR/RL/RR channel order',()=>{
 const b=Buffer.alloc(264);const f=(i,v)=>b.writeFloatLE(v,i*4);
 f(1,125.5);f(2,2400);f(7,30);f(29,.75);f(31,.2);f(33,10);f(37,650);f(61,8200);f(63,800);
 [101,102,103,104].forEach((v,i)=>f(51+i,v));
 const s=parseDirt(b,1000);assert.equal(s.speed,108);assert.equal(s.rpm,6500);assert.equal(s.maxRpm,8000);assert.equal(s.gear,'R');assert.equal(s.elapsed,125.5);assert.deepEqual(s.brakes,[103,104,101,102]);assert.equal(s.fuel,null);
 f(33,0);assert.equal(parseDirt(b).gear,'N');
 f(33,4);assert.equal(parseDirt(b).gear,'4');
});
test('DiRT rejects truncated, foreign and non-finite packets',()=>{
 assert.equal(parseDirt(Buffer.alloc(263)),null);assert.equal(parseDirt(Buffer.alloc(265)),null);assert.equal(parseDirt(Buffer.alloc(264)),null);
 const b=Buffer.alloc(264);b.writeFloatLE(800,252);b.writeFloatLE(NaN,148);assert.equal(parseDirt(b),null);
});
test('Funbit units stay km/h, unavailable values stay null, gear and flags translate',()=>{
 const s=parseEts({game:{connected:true,paused:true},truck:{speed:82,engineRpm:1400,displayedGear:-1,gameThrottle:.7,wearEngine:.1,waterTemperature:90},navigation:{estimatedDistance:120000,speedLimit:90},job:{sourceCity:'Paris',destinationCity:'Lyon'},trailer:{attached:true,name:'Gravel'}});
 assert.equal(s.speed,82);assert.equal(s.remaining,120000);assert.equal(s.rpm,1400);assert.equal(s.fuel,null);assert.equal(s.gear,'R');assert.equal(s.route,'Paris → Lyon');assert.equal(s.paused,true);assert.equal(s.damage,.1);
 assert.throws(()=>parseEts({truck:{}}));
 assert.equal(s.cargo,'Gravel');
 assert.equal(parseEts({game:{connected:false}}).connected,false);
});
test('HTTP requires token, restricts origins, serves assets and serializes freshness metadata',async()=>{
 const server=http.createServer(createHandler({token:'test-token-123456789',origins:['https://albertoc17.github.io'],getSample:()=>({game:'dirt',receivedAt:123})}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(`${base}/api/telemetry?game=dirt`)).status,401);
  const headers={Authorization:'Bearer test-token-123456789',Origin:'https://evil.example'};
  assert.equal((await fetch(`${base}/api/telemetry?game=dirt`,{headers})).status,403);
  headers.Origin='https://albertoc17.github.io';
  const r=await fetch(`${base}/api/telemetry?game=dirt`,{headers});const body=await r.json();
  assert.equal(r.status,200);assert.equal(body.sample.receivedAt,123);assert.equal(body.version,1);assert.ok(body.serverTime>123);assert.equal(r.headers.get('access-control-allow-origin'),headers.Origin);
  assert.equal((await fetch(`${base}/api/telemetry?game=other`,{headers})).status,400);
  assert.equal((await fetch(`${base}/.env`)).status,404);
  const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/APEX/);
  assert.equal((await fetch(`${base}/app.js`,{headers:{Origin:base}})).status,200);
  const preflight=await fetch(`${base}/api/telemetry`,{method:'OPTIONS',headers:{Origin:headers.Origin}});assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
