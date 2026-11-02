export function localEndpoint(ip,port='8787'){
 const parts=ip.trim().split('.');
 if(parts.length!==4||parts.some(p=>!/^\d{1,3}$/.test(p)||Number(p)>255))throw Error('Escribe la IP del PC, por ejemplo 192.168.1.20.');
 const [a,b]=parts.map(Number);
 if(!(a===10||a===127||(a===192&&b===168)||(a===172&&b>=16&&b<=31)||(a===169&&b===254)))throw Error('Usa la IP de tu red local que muestra APEX en el PC.');
 if(!/^\d+$/.test(String(port))||Number(port)<1||Number(port)>65535)throw Error('El puerto debe estar entre 1 y 65535.');
 return `http://${parts.map(Number).join('.')}:${Number(port)}`;
}
