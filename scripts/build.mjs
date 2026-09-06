import {build} from 'esbuild';
import fs from 'node:fs';
await build({entryPoints:['electron/main.ts'],outfile:'dist-electron/main.cjs',bundle:true,platform:'node',format:'cjs',external:['electron']});
await build({entryPoints:['electron/preload.ts'],outfile:'dist-electron/preload.cjs',bundle:true,platform:'node',format:'cjs',external:['electron']});
fs.copyFileSync('assets/icon.png','dist-electron/icon.png');
// The preview fixture is for local visual QA, never a production data source.
fs.rmSync('dist/preview.json',{force:true});
