const $=id=>document.getElementById(id);
const read=(store,key,fallback)=>{try{return JSON.parse(store.getItem(key))??fallback;}catch{return fallback;}};
const save=(store,key,value)=>{try{store.setItem(key,JSON.stringify(value));}catch{}};
const settings=read(localStorage,'apex.settings',{endpoint:'',units:'kmh',rate:100,wake:false,game:'dirt'});
let game=['dirt','ets2'].includes(settings.game)?settings.game:'dirt',mode='demo',sample=null,generation=0,controller=null,wakeLock=null,view='drive',lastSuccess=0,lastServerAge=0,demoStart=performance.now(),latency=null;
let message='',history=[],lastSampleStamp=0;
const fmt=(v,d=0)=>Number.isFinite(v)?v.toLocaleString('es-CL',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const duration=v=>Number.isFinite(v)?`${String(Math.floor(v/60)).padStart(2,'0')}:${(v%60).toFixed(1).padStart(4,'0')}`:'—';
const unit=()=>settings.units==='mph'?'MI':'KM';
const distance=v=>Number.isFinite(v)?`${fmt(v/1000*(settings.units==='mph'?.621371:1),2)} ${unit()}`:'—';
const text=(id,value)=>{$(id).textContent=value??'—';};
const setWidth=(id,value)=>{$(id).style.width=`${Math.max(0,Math.min(100,value||0))}%`;};
const lights=Array.from({length:18},(_,i)=>{const e=document.createElement('i');if(i>=14)e.className='red';else if(i>=11)e.className='amber';$('shift-lights').append(e);return e;});
function toast(value){text('toast',value);$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,3500);}
function demo(){
 const t=(performance.now()-demoStart)/1000,truck=game==='ets2',cycle=(t%180)/180;
 return {game,connected:true,paused:false,receivedAt:Date.now(),speed:truck?79+Math.sin(t/8)*7:100+Math.sin(t/5)*42,rpm:truck?1450+Math.sin(t/3)*230:5000+Math.sin(t/2)*2200,maxRpm:truck?2500:8000,gear:truck?'12':String(3+Math.floor((Math.sin(t/5)+1)*1.4)),throttle:.55+Math.sin(t*1.2)*.4,brake:Math.max(0,Math.sin(t/3)-.5),clutch:Math.max(0,Math.sin(t*2)-.97)*20,elapsed:t%180,distance:cycle*8200,totalDistance:8200,gLat:Math.sin(t)*.8,gLong:Math.cos(t/2)*.5,vehicle:truck?'Volvo FH · Demo':null,brakes:[140+Math.sin(t)*25,145,130,137],water:truck?86:null,oil:truck?93:null,air:truck?121:null,battery:truck?27.6:null,fuel:truck?482:null,fuelCapacity:truck?800:null,consumption:truck?.31:null,damage:truck?.024:null,odometer:truck?42856:null,remaining:truck?186000-cycle*5000:null,speedLimit:truck?90:null,route:truck?'Hamburg → Berlin':null,cargo:truck?'Materiales de construcción':null,income:truck?8450:null,warnings:[],lastTime:null};
}
function isFresh(){return mode==='demo'||(sample?.connected && lastServerAge+(performance.now()-lastSuccess)<2500);}
function metric(label,value,note){const el=document.createElement('article');el.className='panel metric';for(const [tag,content] of [['span',label],['strong',value],['small',note]]){const node=document.createElement(tag);node.textContent=content??'—';el.append(node);}return el;}
function metrics(id,rows){$(id).replaceChildren(...rows.map(row=>metric(...row)));}
function renderDetails(s){
 const truck=game==='ets2';
 text('info-vehicle',s?.vehicle||'Estado del vehículo');
 metrics('vehicle-metrics',truck?[
 ['COMBUSTIBLE',Number.isFinite(s?.fuel)?`${fmt(s.fuel,1)} L`:'—',Number.isFinite(s?.fuelCapacity)?`Depósito: ${fmt(s.fuelCapacity)} L`:'Capacidad no disponible'],
 ['REFRIGERANTE',Number.isFinite(s?.water)?`${fmt(s.water)} °C`:'—','Temperatura del motor'],
 ['ACEITE',Number.isFinite(s?.oil)?`${fmt(s.oil)} °C`:'—','Temperatura de aceite'],
 ['DESGASTE MOTOR',Number.isFinite(s?.damage)?`${fmt(s.damage*100,1)} %`:'—','0 % = sin desgaste'],
 ['AIRE DE FRENOS',Number.isFinite(s?.air)?`${fmt(s.air)} PSI`:'—','Presión del depósito'],
 ['BATERÍA',Number.isFinite(s?.battery)?`${fmt(s.battery,1)} V`:'—','Tensión eléctrica'],
 ['CONSUMO',Number.isFinite(s?.consumption)?`${fmt(s.consumption*100,1)} L`:'—','Por cada 100 km'],
 ['ODÓMETRO',Number.isFinite(s?.odometer)?distance(s.odometer*1000):'—','Distancia total del vehículo']
 ]:[['RÉGIMEN MÁXIMO',fmt(s?.maxRpm),'RPM · límite del motor'],['FUERZA LATERAL',Number.isFinite(s?.gLat)?`${fmt(s.gLat,2)} G`:'—','Aceleración lateral'],['FUERZA LONGITUDINAL',Number.isFinite(s?.gLong)?`${fmt(s.gLong,2)} G`:'—','Aceleración y frenada'],['TEMPERATURAS MOTOR','—','No disponibles en UDP DiRT']]);
 $('wheels').replaceChildren(...['DEL. IZQ.','DEL. DER.','TRAS. IZQ.','TRAS. DER.'].map((label,i)=>{const e=document.createElement('div');e.className='wheel';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=Number.isFinite(s?.brakes?.[i])?`${fmt(s.brakes[i])}°`:'—';e.append(a,b);return e;}));
 text('brake-note',truck?'ETS2 / Funbit entrega una temperatura común de frenos, repetida en las cuatro posiciones.':'DiRT transmite cuatro canales de freno; pueden no estar poblados según el vehículo.');
 text('session-hero-value',truck?(s?.route||'Sin ruta disponible'):duration(s?.elapsed));
 text('session-subtitle',truck?(s?.cargo||'Sin carga disponible'):`${distance(s?.distance)} recorridos · ${distance(s?.totalDistance)} de etapa`);
 const progress=truck?null:s?.totalDistance>0?s.distance/s.totalDistance:0;
 $('stage-car').style.left=`${Math.min(100,Math.max(0,(progress||0)*100))}%`;
 $('stage-car').hidden=truck;
 metrics('session-metrics',truck?[
 ['DISTANCIA RESTANTE',distance(s?.remaining),'Estimación del navegador del juego'],['LÍMITE DE VÍA',Number.isFinite(s?.speedLimit)?`${fmt(s.speedLimit*(settings.units==='mph'?.621371:1))} ${settings.units==='mph'?'MPH':'KM/H'}`:'—','Información de navegación'],['INGRESO DEL TRABAJO',Number.isFinite(s?.income)?`${fmt(s.income)} €`:'—','Según API de trabajo'],['ESTADO',s?(s.paused?'PAUSADO':'EN RUTA'):'—',s?.cargo||'Sin datos de carga']
 ]:[['DISTANCIA RECORRIDA',distance(s?.distance),'Desde la salida'],['DISTANCIA RESTANTE',s?.totalDistance>0?distance(Math.max(0,s.totalDistance-(s.distance||0))):'—','Hasta la meta'],['PROGRESO',s?.totalDistance>0?`${fmt(progress*100,1)} %`:'—','Recorrido de etapa'],['ÚLTIMO TIEMPO',duration(s?.lastTime),'Si el juego lo transmite']]);
}
function render(){
 if(mode==='demo')sample=demo();
 const fresh=isFresh(),s=fresh?sample:null,truck=game==='ets2';
 const rpmRatio=s?.maxRpm>0?Math.max(0,Math.min(1,s.rpm/s.maxRpm)):0;
 text('speed',Number.isFinite(s?.speed)?fmt(Math.abs(s.speed)*(settings.units==='mph'?.621371:1)):'—');text('speed-unit',settings.units==='mph'?'MPH':'KM/H');
 text('gear',s?.gear);text('rpm',fmt(s?.rpm));text('rpm-mid',s?.maxRpm>0?fmt(s.maxRpm/2):'—');text('rpm-max',s?.maxRpm>0?`${fmt(s.maxRpm)} RPM`:'RPM');
 $('rpm-arc').style.strokeDashoffset=100-rpmRatio*100;
 lights.forEach((e,i)=>e.classList.toggle('on',rpmRatio>i/18));document.body.classList.toggle('redline',rpmRatio>.92);
 text('shift-hint',rpmRatio>.92?'CAMBIA ↑':truck?'TRANSMISIÓN':'SECUENCIAL');
 for(const field of ['throttle','brake','clutch']){text(field,Number.isFinite(s?.[field])?`${fmt(s[field]*100)}%`:'—');setWidth(`${field}-bar`,(s?.[field]||0)*100);}
 text('vehicle-name',s?.vehicle||(truck?'PERFIL ETS2':'PERFIL DiRT 2.0'));
 text('quick-a',truck?(Number.isFinite(s?.fuel)?`${fmt(s.fuel)} L`:'—'):duration(s?.elapsed));
 text('quick-b',truck?distance(s?.remaining):distance(s?.distance));
 setWidth('quick-progress',truck?(s?.fuelCapacity>0?s.fuel/s.fuelCapacity*100:0):(s?.totalDistance>0?s.distance/s.totalDistance*100:0));
 let state=mode==='demo'?'● DEMO':fresh?(s.paused?'● PAUSADO':'● EN VIVO'):'○ SIN DATOS';
 text('status',state);$('status').classList.toggle('error',mode!=='demo'&&!fresh);
 text('source-label',mode==='demo'?'DATOS SIMULADOS':fresh?'TELEMETRÍA DEL PC':'ESPERANDO TELEMETRÍA');
 text('sample-age',mode==='demo'?'MODO DEMO':fresh?`${fmt(latency)} MS · ${Math.round(1000/settings.rate)} HZ`:'CONEXIÓN PENDIENTE');
 const note=mode==='demo'?'Demostración · valores ficticios. Conecta tu PC para ver datos reales.':message||(!fresh?'Puente sin datos recientes. Comprueba que el juego esté abierto y la telemetría habilitada.':s?.warnings?.join(' · ')||'');
 text('connection-note',note);$('connection-note').hidden=!note;
 if(view!=='drive')renderDetails(s);
 if(s && lastSampleStamp!==s.receivedAt){history.push(s.speed);if(history.length>100)history.shift();lastSampleStamp=s.receivedAt;}
}
function profile(){
 const truck=game==='ets2';$('game').value=game;
 text('cockpit-label',truck?'INSTRUMENTOS / TRUCK':'INSTRUMENTOS / RALLY');text('session-tab',truck?'Viaje':'Etapa');
 text('session-label',`${truck?'TRUCK':'RALLY'} / ${mode==='demo'?'DEMOSTRACIÓN':'TELEMETRÍA'}`);
 text('quick-label',truck?'EN ESTE VIAJE':'EN ESTA ETAPA');text('quick-a-label',truck?'COMBUSTIBLE':'TIEMPO');text('quick-b-label',truck?'RESTANTE':'RECORRIDO');
 text('session-eyebrow',truck?'KILÓMETRO A KILÓMETRO':'CADA SEGUNDO CUENTA');text('session-title',truck?'Tu viaje, al detalle.':'Tu etapa, al detalle.');
 text('session-type',truck?'TRUCK':'RALLY');text('hero-label',truck?'RUTA DEL TRABAJO':'TIEMPO DE ETAPA');text('track-start',truck?'ORIGEN':'SALIDA');text('track-end',truck?'DESTINO':'META');
 text('session-footnote',truck?'La ruta y la carga dependen del trabajo activo y de los datos publicados por el plugin Funbit.':'DiRT no transmite clasificación, notas del copiloto ni nombres de tramo en este paquete.');
 text('demo-toggle',mode==='demo'?'Demo activa · conectar mi PC ↗':'Conexión del PC · ajustes ↗');
 render();
}
function stop(){generation++;controller?.abort();controller=null;sample=null;lastSuccess=0;message='';}
async function connect(){
 stop();mode='live';profile();const myGeneration=generation;
 async function poll(){
  if(myGeneration!==generation)return;
  if(!document.hidden){
   controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),3000);const started=performance.now();
   try{
    const url=new URL('api/telemetry',settings.endpoint.endsWith('/')?settings.endpoint:`${settings.endpoint}/`);url.searchParams.set('game',game);
    const response=await fetch(url,{headers:{Authorization:`Bearer ${read(sessionStorage,'apex.token','')}`},cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error(response.status===401?'Token incorrecto. Abre ajustes y copia el token del puente.':response.status===403?'Origen no autorizado. Revisa APEX_ORIGINS en el PC.':`El puente respondió ${response.status}.`);
    const payload=await response.json();if(payload.version!==1||!Number.isFinite(payload.serverTime)||!Object.hasOwn(payload,'sample'))throw Error('Respuesta incompatible con APEX. Revisa la dirección.');
    if(payload.sample && (payload.sample.game!==game||!Number.isFinite(payload.sample.receivedAt)))throw Error('Paquete de telemetría incompatible.');
    if(myGeneration!==generation)return;
    sample=payload.sample;latency=performance.now()-started;lastSuccess=performance.now();lastServerAge=sample?Math.max(0,payload.serverTime-sample.receivedAt):Infinity;message='';
   }catch(e){if(myGeneration!==generation)return;sample=null;message=e.name==='AbortError'?'El puente no responde. Comprueba dirección, Wi-Fi y firewall.':e instanceof TypeError?'No se pudo conectar. Revisa HTTPS, certificado, Wi-Fi, token y origen permitido.':e.message;}
   finally{clearTimeout(timeout);}
  }
  if(myGeneration===generation)setTimeout(poll,Number(settings.rate)||100);
 }
 poll();
}
function openSettings(){
 $('endpoint').value=settings.endpoint||(/^https?:/.test(location.protocol)&&location.port==='8787'?location.origin:'');$('token').value=read(sessionStorage,'apex.token','');$('units').value=settings.units||'kmh';$('rate').value=String(settings.rate||100);$('wake').checked=!!settings.wake;text('config-error','');$('config').showModal();
}
async function requestWake(){
 if(!settings.wake){await wakeLock?.release();wakeLock=null;return;}
 try{if('wakeLock' in navigator&&!document.hidden)wakeLock=await navigator.wakeLock.request('screen');else toast('Safari no ofrece bloqueo de pantalla aquí. Revisa Bloqueo automático en iOS.');}catch{toast('No se pudo mantener la pantalla encendida.');}
}
document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==view);document.querySelectorAll('.tab').forEach(e=>{e.classList.toggle('active',e===button);if(e===button)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');});render();}));
for(const id of ['settings','demo-toggle'])$(id).addEventListener('click',openSettings);
let focusBeforeDialog=null;$('config').addEventListener('close',()=>focusBeforeDialog?.focus());
$('close-config').addEventListener('click',()=>$('config').close());
$('config-form').addEventListener('submit',event=>{
 event.preventDefault();let url;
 try{url=new URL($('endpoint').value.trim());if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Usa solo dirección y puerto, sin ruta, contraseña ni parámetros.');if(location.protocol==='https:'&&url.protocol==='http:')throw Error('GitHub Pages necesita un puente HTTPS. Usa un túnel HTTPS o abre la página local del puente.');if($('token').value.trim().length<16)throw Error('Copia el token completo del puente (mínimo 16 caracteres).');}
 catch(error){text('config-error',error.message==='Invalid URL'?'Escribe una dirección completa, por ejemplo https://tu-puente.example.com.':error.message);return;}
 Object.assign(settings,{endpoint:url.origin,units:$('units').value,rate:Number($('rate').value),wake:$('wake').checked,game});save(localStorage,'apex.settings',settings);save(sessionStorage,'apex.token',$('token').value.trim());$('config').close();requestWake();connect();
});
$('start-demo').addEventListener('click',()=>{stop();mode='demo';demoStart=performance.now();$('config').close();profile();});
$('game').addEventListener('change',()=>{game=$('game').value;settings.game=game;save(localStorage,'apex.settings',settings);sample=null;history=[];demoStart=performance.now();if(mode==='live')connect();else profile();});
$('screen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('En Safari usa Compartir → Añadir a pantalla de inicio.');}catch{toast('Usa Compartir → Añadir a pantalla de inicio en Safari.');}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){sample=null;lastSuccess=0;if(mode==='demo')sample=demo();if(settings.wake)requestWake();render();}});
profile();setInterval(render,100);
// Reconnect only when a token exists in this tab; otherwise start with a clearly marked demo.
if(settings.endpoint&&read(sessionStorage,'apex.token',''))connect();
