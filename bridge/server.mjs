import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';
import {parseDirt,parseEts} from './adapters.mjs';

export function privateAddress(address=''){
  const ip=address.replace(/^::ffff:/,'');
  if(ip==='::1')return true;
  const p=ip.split('.');if(p.length!==4||p.some(v=>!/^\d{1,3}$/.test(v)||Number(v)>255))return false;
  const [a,b]=p.map(Number);
  return a===10||a===127||(a===192&&b===168)||(a===172&&b>=16&&b<=31)||(a===169&&b===254);
}
export function createHandler({token,origins=[],getSample,lan=false,addresses=[]}) {
  return async (req,res) => {
    const origin=req.headers.origin;
    let sameOrigin=false;
    try{sameOrigin=!!origin && new URL(origin).host===req.headers.host;}catch{}
    if (origin && !sameOrigin && !origins.includes(origin)) {res.writeHead(403);res.end('Origen no autorizado');return;}
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Authorization, X-Apex-Client');
      res.setHeader('Access-Control-Allow-Private-Network','true');
      res.writeHead(204);res.end();return;
    }
    const url=new URL(req.url,'http://bridge.local');
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    // LAN opt-in accepts only private literal hosts and private peers, never public tunnel hosts.
    let host='';try{host=new URL(`http://${req.headers.host}`).hostname;}catch{res.writeHead(400);res.end('Host no válido');return;}
    const lanAccess=lan && privateAddress(host) && privateAddress(req.socket.remoteAddress) && (!origin||sameOrigin) && !['cross-site','same-site'].includes(req.headers['sec-fetch-site']);
    if(url.pathname==='/api/info'){
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({lanAccess,addresses,port:req.socket.localPort}));return;
    }
    if(url.pathname==='/api/telemetry'){
      const provided=Buffer.from(req.headers.authorization ?? '');
      const expected=Buffer.from(`Bearer ${token}`);
      const authenticated=provided.length===expected.length && timingSafeEqual(provided,expected);
      if(!authenticated && !(lanAccess && req.headers['x-apex-client']==='dashboard')){res.writeHead(401);res.end('Token incorrecto');return;}
      const game=url.searchParams.get('game');
      if(!['dirt','ets2'].includes(game)){res.writeHead(400);res.end('Juego no válido');return;}
      res.setHeader('Content-Type','application/json');
      const sample=getSample(game);
      res.end(JSON.stringify({version:1,serverTime:Date.now(),sample}));return;
    }
    // Explicit asset allowlist: no arbitrary filesystem paths.
    const assets={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/connection.js':'connection.js','/icon.svg':'icon.svg','/manifest.webmanifest':'manifest.webmanifest'};
    const asset=assets[url.pathname];
    if(!asset){res.writeHead(404);res.end();return;}
    try{
      let content=await readFile(new URL(`../web/${asset}`,import.meta.url));
      if(asset==='index.html')content=content.toString().replace('<!--APEX_BRIDGE-->','<meta name="apex-bridge" content="1">');
      const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
      res.setHeader('Content-Type',types[asset.split('.').pop()]);res.end(content);
    }catch {res.writeHead(500);res.end('No se pudo leer el archivo');}
  };
}
export async function startBridge(env=process.env) {
  const token=env.APEX_TOKEN || randomBytes(24).toString('hex');
  if(token.length<16)throw new Error('APEX_TOKEN debe tener al menos 16 caracteres');
  const port=Number(env.PORT || 8787), udpPort=Number(env.DIRT_PORT || 20777);
  const origins=(env.APEX_ORIGINS || 'https://albertoc17.github.io').split(',').map(v=>v.trim()).filter(Boolean);
  let dirt=null,ets=null,stopped=false;
  const udp=dgram.createSocket('udp4');
  udp.on('message',b=>{const sample=parseDirt(b);if(sample)dirt=sample;});
  udp.on('error',e=>console.error('UDP:',e.message,'Revisa si SimHub ya usa el puerto.'));
  udp.bind(udpPort,'127.0.0.1');
  const upstream=new URL(env.ETS_URL || 'http://127.0.0.1:25555/api/ets2/telemetry');
  if(!['127.0.0.1','localhost','[::1]'].includes(upstream.hostname) || !['http:','https:'].includes(upstream.protocol))throw new Error('ETS_URL debe apuntar al PC local');
  async function pollEts(){
    if(stopped)return;
    try{const r=await fetch(upstream,{signal:AbortSignal.timeout(1500)});if(!r.ok)throw Error();ets=parseEts(await r.json());}catch{/* Sample expires naturally; never replace it with fabricated data. */}
    if(!stopped)etsTimer=setTimeout(pollEts,100);
  }
  let etsTimer;pollEts();
  const addresses=Object.values(networkInterfaces()).flat().filter(n=>n?.family==='IPv4'&&!n.internal&&privateAddress(n.address)).map(n=>n.address);
  const lan=env.APEX_LAN==='1'||process.argv.includes('--lan');
  const handler=createHandler({token,origins,getSample:g=>g==='dirt'?dirt:ets,lan,addresses});
  const tls=env.TLS_CERT && env.TLS_KEY;
  const server=tls?https.createServer({cert:await readFile(env.TLS_CERT),key:await readFile(env.TLS_KEY)},handler):http.createServer(handler);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,env.APEX_HOST || '0.0.0.0',resolve);});
  console.log(`\nAPEX TELEMETRY · puente listo\nToken de sesión: ${token}\nUDP DiRT: 127.0.0.1:${udpPort}\nETS2: ${upstream}\n`);
  for(const address of addresses)console.log(`IP DEL PC: ${address}\nPUERTO: ${port}\nABRE EN EL IPAD: ${tls?'https':'http'}://${address}:${port}\n`);
  console.log(lan?'MODO WI-FI: los dispositivos de tu red privada pueden leer telemetría al abrir la IP del PC.':'Modo protegido: introduce el token. Para conectar solo por IP usa npm run lan.');
  console.log(`PC: ${tls?'https':'http'}://localhost:${port}\nDesde GitHub Pages usa HTTPS con certificado confiable o túnel HTTPS. Consulta README.md.\n`);
  const close=()=>{stopped=true;clearTimeout(etsTimer);udp.close();server.close();};
  process.once('SIGINT',close);process.once('SIGTERM',close);
  return {server,close};
}
if(process.argv[1]===fileURLToPath(import.meta.url))startBridge().catch(e=>{console.error(e.message);process.exit(1);});
