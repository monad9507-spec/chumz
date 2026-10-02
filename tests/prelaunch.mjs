import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const plugins=[{name:'appkit-test-double',setup(b){b.onResolve({filter:/^@reown\/appkit(?:-adapter-ethers)?$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.endsWith('ethers')?'export class EthersAdapter {}':'export function createAppKit(c){window.__config=c;return window.__modal;}'}));}}];
const bundle=(await build({entryPoints:['src/app.js'],bundle:true,format:'iife',write:false,plugins})).outputFiles[0].text;
const pause=()=>new Promise(r=>setTimeout(r,30));
for(const file of ['index.html','stake/index.html','docs/index.html']){
 const dom=new JSDOM(readFileSync('dist/'+file,'utf8'),{url:'https://chumz.example/'+file,runScripts:'outside-only'});
 const w=dom.window;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.setInterval=()=>0;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let account={isConnected:false},view,callback;const address='0x1111111111111111111111111111111111111111';
 w.__modal={subscribeAccount(cb){callback=cb;},subscribeProviders(){},subscribeNetwork(){},getAccount(){return account;},getWalletProvider(){return{request:async()=> '0x1237'};},open:async o=>{view=o.view;},disconnect:async()=>{account={isConnected:false};callback();}};
 w.eval(readFileSync('dist/site-config.js','utf8'));w.eval(bundle);await pause();
 assert.equal(w.__config.projectId,'4f71172824a0ea69b0270161482356fe');assert.equal(w.__config.themeMode,'dark');assert.equal(w.__config.themeVariables['--w3m-accent'],'#b9ff00');
 assert.equal(w.__config.networks[0].id,4663);assert.equal(w.__config.features.email,false);
 for(const e of w.document.querySelectorAll('[src],[href]')){const url=(e.getAttribute('src')||e.getAttribute('href')||'').split('#')[0];if(url.startsWith('/')&&!url.startsWith('//')){let path='dist'+url;if(url.endsWith('/'))path+='index.html';assert(existsSync(path),path);}}
 const connect=w.document.querySelector('[data-connect]');connect.click();await pause();assert.equal(view,'Connect');
 account={isConnected:true,address};callback();await pause();assert.match(connect.textContent,/0x1111/);
 connect.click();await pause();assert.equal(view,'Account');await w.__modal.disconnect();await pause();assert.equal(connect.textContent,'Connect wallet');
 if(file==='index.html'){assert(w.document.getElementById('mint-button').disabled);w.document.querySelector('[data-qty="100"]').click();assert.equal(w.document.getElementById('mint-cost').textContent,'2,000,000 CHUMZ');}
 if(file.startsWith('stake')){assert(w.document.getElementById('claim-button').disabled);assert(w.document.getElementById('stake-button').disabled);assert.match(w.document.body.textContent,/PER NFT \/ HOUR30 CHUMZ/);}
 assert(!w.document.body.textContent.includes('✳'));assert(!w.document.body.textContent.includes('10,000 CHUMZ'));
 dom.window.close();console.log('PASS',file,'AppKit configuration, connect/account callbacks, assets and prelaunch controls (mock provider)');
}
