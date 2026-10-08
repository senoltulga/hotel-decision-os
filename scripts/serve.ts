import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
const port=Number(process.env.HDSE_PORT??'8766');
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('HDSE_PORT 1024–65535 arasında olmalı.');
if(!existsSync('dist/index.html'))throw new Error('Önce npm run build çalıştırın.');
createServer((request,response)=>{
  if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405);response.end();return;}
  if(!['/','/index.html','/simulation.html'].includes((request.url??'/').split('?')[0])){response.writeHead(404);response.end('Not found');return;}
  const html=readFileSync('dist/index.html');response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':html.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(request.method==='HEAD'?undefined:html);
}).listen(port,'127.0.0.1',()=>console.log(`HDSE: http://localhost:${port}/`));
