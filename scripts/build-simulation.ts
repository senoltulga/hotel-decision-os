import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('artifacts/T03', { recursive: true });
const bundle = await build({ entryPoints: ['src/features/simulation/simulation.ui.ts'], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2023' });
const script = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = readFileSync('src/features/simulation/simulation.template.html', 'utf8');
writeFileSync('artifacts/T03/hotel-price-simulation.html', template.replace('<!-- HDSE_SCRIPT -->', `<script>\n${script}\n</script>`));
console.log('Simülasyon hazır: artifacts/T03/hotel-price-simulation.html');
