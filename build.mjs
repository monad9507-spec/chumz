import {rmSync} from 'node:fs';
import {build} from 'esbuild';
rmSync('dist/js',{recursive:true,force:true});
await build({entryPoints:['src/app.js'],bundle:true,format:'esm',splitting:true,outdir:'dist/js',target:['es2022'],minify:true,define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
