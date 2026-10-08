import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
mkdirSync('dist',{recursive:true});
const result=await build({entryPoints:['src/features/workbench/workbench.ui.ts'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2023'});
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const template=readFileSync('src/features/workbench/index.template.html','utf8');
writeFileSync('dist/index.html',template.replace('<!-- HDSE_APP_SCRIPT -->',`<script>\n${script}\n</script>`));
console.log('HDSE uygulaması hazır: dist/index.html');
