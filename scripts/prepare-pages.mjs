import {readFile,writeFile} from 'node:fs/promises';
const revision=process.env.GITHUB_SHA;
if(!/^[a-f0-9]{40}$/.test(revision||''))throw Error('GITHUB_SHA requerido para preparar Pages');
const root=new URL('../web/',import.meta.url);
const html=await readFile(new URL('index.html',root),'utf8');
await writeFile(new URL('index.html',root),html.replace('href="style.css"',`href="style.css?v=${revision}"`).replace('src="app.js"',`src="app.js?v=${revision}"`));
const js=await readFile(new URL('app.js',root),'utf8');
await writeFile(new URL('app.js',root),js.replace("'./connection.js'",`'./connection.js?v=${revision}'`));
