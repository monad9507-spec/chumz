import {Contract,JsonRpcProvider,FetchRequest,formatUnits,isAddress,ZeroAddress} from 'ethers';
import NFT_ABI from './FomoChumz.json';
import STAKE_ABI from './ChumzStaking.json';
import * as wallet from './wallet.js';
const C=window.CHUMZ_CONFIG,$=id=>document.getElementById(id),page=document.body.dataset.page;
const TOKEN_ABI=['function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)'];
const configured=isAddress(C.nftAddress)&&C.nftAddress!==ZeroAddress;
const request=new FetchRequest(C.rpcUrl);request.timeout=12000;
const rpc=new JsonRpcProvider(request,undefined,{batchMaxCount:20});
const state={address:null,chainId:0,ready:false,busy:false,price:0n,decimals:18,minted:0,walletMinted:0,open:false,balance:0n,earned:0n,next:0,staked:0,offset:0};
let nft,pool,token,refreshing=false;const owned=new Map(),staked=new Map(),chosen=new Set();let inventoryTab='wallet',inventoryBusy=false,inventoryEpoch=0;
const text=(id,value)=>{if($(id))$(id).textContent=value;};
const short=a=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'';
const number=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const amount=n=>number(formatUnits(n,state.decimals));
function notice(message,error=false){const box=$('notice');box.hidden=false;box.classList.toggle('error',error);text('notice-text',message);}
function errorMessage(e){if(e.code===4001||e.code==='ACTION_REJECTED')return 'Request cancelled in your wallet.';return e.revert?.name?({ClaimTooEarly:'Your 24-hour claim timer has not finished.',NoRewards:'There are no rewards to claim.',MintClosed:'Mint is currently closed.',WalletLimit:'This wallet has reached its lifetime mint limit.',SoldOut:'The collection is sold out.',InexactTokenTransfer:'CHUMZ transfers do not match the expected amount. Transaction reverted.'}[e.revert.name]||e.revert.name):(e.shortMessage||e.reason||e.message||'Something went wrong. Please retry.');}
function quantity(){const n=Number($('quantity')?.value||1);return Number.isInteger(n)&&n>=1&&n<=100?n:1;}
function update(){
 document.querySelectorAll('[data-connect]').forEach(b=>b.textContent=state.address?short(state.address):'Connect wallet');
 text('wallet-detail',state.address?`${short(state.address)} · ${state.chainId===4663?'Robinhood Chain':'Switch to Robinhood'}`:'Choose your wallet to continue.');
 const q=quantity();text('mint-cost',state.ready?amount(state.price*BigInt(q))+' CHUMZ':number(q*20000)+' CHUMZ');
 if($('mint-button')){$('mint-button').disabled=state.busy||!state.ready||!state.open||state.minted>=8888;$('mint-button').textContent=!configured?'Mint coming soon':!state.ready?'Mint unavailable':state.minted>=8888?'Sold out':!state.open?'Mint closed':!state.address?'Connect to mint':'Approve & mint';}
 text('your-balance',state.address&&state.ready?amount(state.balance)+' CHUMZ':'—');text('wallet-minted',state.address&&state.ready?`${state.walletMinted} / 100`:'— / 100');
 text('your-staked',state.address&&state.ready?state.staked:'—');text('earned',state.address&&state.ready?amount(state.earned):'—');
 const remaining=Math.max(0,state.next-Math.floor(Date.now()/1000+state.offset));
 text('claim-timer',!state.address?'Connect your wallet':!state.next?'Starts with your first stake':remaining?`${String(Math.floor(remaining/3600)).padStart(2,'0')}:${String(Math.floor(remaining%3600/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`:'Ready to claim');
 if($('claim-button')){$('claim-button').disabled=state.busy||!state.ready||(!!state.address&&(!state.next||remaining>0||state.earned===0n));text('claim-button',state.address?'Claim CHUMZ':'Connect wallet');}
 if($('stake-button')){$('stake-button').disabled=state.busy||!state.ready||!state.address||chosen.size===0;text('stake-button',`${inventoryTab==='wallet'?'Stake':'Unstake'}${chosen.size?' '+chosen.size+' NFT'+(chosen.size===1?'':'s'):''}`);}
 if($('disconnect'))$('disconnect').hidden=!state.address;
 text('selection-count',`${chosen.size} selected`);
}
async function refresh(){if(refreshing||!configured)return;refreshing=true;
 try{
  if(Number(await rpc.send('eth_chainId',[]))!==4663)throw Error('The configured RPC is not Robinhood Chain.');
  nft ||= new Contract(C.nftAddress,NFT_ABI,rpc);token ||= new Contract(C.tokenAddress,TOKEN_ABI,rpc);
  const [tokenAddress,supply,limit,price,minted,open,poolAddress,decimals,block]=await Promise.all([nft.paymentToken(),nft.MAX_SUPPLY(),nft.MAX_PER_WALLET(),nft.mintPrice(),nft.totalMinted(),nft.mintOpen(),nft.staking(),token.decimals(),rpc.getBlock('latest')]);
  if(tokenAddress.toLowerCase()!==C.tokenAddress.toLowerCase()||supply!==8888n||limit!==100n)throw Error('Collection configuration does not match Fomo Chumz.');
  if(C.stakingAddress&&C.stakingAddress.toLowerCase()!==poolAddress.toLowerCase())throw Error('Staking address does not match the collection.');
  pool=new Contract(poolAddress,STAKE_ABI,rpc);
  const [collection,rewardToken,interval,rate,totalStaked,available,runway,burnMode]=await Promise.all([pool.collection(),pool.rewardToken(),pool.CLAIM_INTERVAL(),pool.rewardPerHour(),pool.totalStaked(),pool.undistributedRewards(),pool.runwaySeconds(),nft.burnMode()]);
  if(collection.toLowerCase()!==C.nftAddress.toLowerCase()||rewardToken.toLowerCase()!==C.tokenAddress.toLowerCase()||interval!==86400n||rate!==30n*10n**decimals||price!==20000n*10n**decimals)throw Error('This site requires the Fomo Chumz v3 staking contract.');
  Object.assign(state,{ready:true,price,decimals:Number(decimals),minted:Number(minted),open,offset:block.timestamp-Date.now()/1000});
  text('minted-count',number(minted));text('mint-status',open?'Mint open':'Mint closed');text('network-state','Robinhood Chain');text('total-staked',number(totalStaked));text('pool-available',amount(available));text('pool-runway',Number(totalStaked)?number(Number(runway)/3600)+' hours':'Waiting for stakers');text('pool-status',available===0n?'Pool empty · new accrual paused':'Rewards funded');
  text('burn-description',burnMode===0n?'70% burned through the token’s burn function.':'70% sent to the dead address; token totalSupply is unchanged.');
  if($('mint-progress'))$('mint-progress').style.width=`${Number(minted)/8888*100}%`;
  document.querySelectorAll('[data-contract-link]').forEach(a=>{a.href=C.explorerUrl+'/address/'+(a.dataset.contractLink==='nft'?C.nftAddress:poolAddress);a.removeAttribute('aria-disabled');a.textContent=short(a.dataset.contractLink==='nft'?C.nftAddress:poolAddress);});
  const addr=state.address;if(addr){const [balance,walletMinted,earned,next,stakedCount]=await Promise.all([token.balanceOf(addr),nft.mintedByWallet(addr),pool.earned(addr),pool.nextClaimAt(addr),pool.stakedBalance(addr)]);if(state.address===addr)Object.assign(state,{balance,walletMinted:Number(walletMinted),earned,next:Number(next),staked:Number(stakedCount)});}
 }catch(e){state.ready=false;text('mint-status','Data unavailable');text('pool-status','Data unavailable');notice(errorMessage(e),true);}finally{refreshing=false;update();}
}
async function changed(){const before=state.address;const s=await wallet.session();Object.assign(state,{address:s?.address||null,chainId:s?.chainId||0,balance:0n,earned:0n,next:0,staked:0,walletMinted:0});if(before!==state.address){inventoryEpoch++;owned.clear();staked.clear();chosen.clear();renderInventory();}update();await refresh();if(before!==state.address&&page==='stake')await loadInventory();}
async function openWallet(){try{await wallet.open(changed);}catch(e){notice('Wallet connection could not open. '+errorMessage(e),true);}}
async function receipt(tx){notice('Transaction submitted. Waiting for confirmation…');const link=$('tx-link');link.href=C.explorerUrl+'/tx/'+tx.hash;link.hidden=false;try{return await tx.wait();}catch(e){if(e.code==='TRANSACTION_REPLACED'&&!e.cancelled)return e.receipt;throw e;}}
async function activeSigner(expected){const sig=await wallet.signer();if((await sig.getAddress()).toLowerCase()!==expected.toLowerCase())throw Error('Wallet changed. Please review and try again.');return sig;}
async function transaction(action){if(!state.address){openWallet();return;}if(!state.ready||state.busy)return;state.busy=true;update();$('tx-link').hidden=true;const account=state.address;try{await action(account);notice('Confirmed. Your balances have been refreshed.');await refresh();if(page==='stake')await loadInventory();}catch(e){notice(errorMessage(e),true);}finally{state.busy=false;update();}}
async function mint(account){const q=quantity();await refresh();if(!state.ready||!state.open)throw Error('Mint is not available.');if(q>100-state.walletMinted)throw Error('Quantity exceeds your remaining lifetime mint allowance.');if(q>8888-state.minted)throw Error('Quantity exceeds the remaining supply.');const cost=state.price*BigInt(q);if(state.balance<cost)throw Error('Not enough CHUMZ for this mint.');let sig=await activeSigner(account);if(await token.allowance(account,C.nftAddress)<cost){notice('Step 1 of 2: approve the exact CHUMZ mint cost in your wallet.');await receipt(await token.connect(sig).approve(C.nftAddress,cost));}sig=await activeSigner(account);notice('Step 2 of 2: confirm your NFT mint.');await receipt(await nft.connect(sig).mint(q));}
async function stakeAction(account){const ids=[...chosen].map(BigInt);if(!ids.length)return;let sig=await activeSigner(account);if(inventoryTab==='wallet'){for(const id of ids)if((await nft.ownerOf(id)).toLowerCase()!==account.toLowerCase())throw Error(`You no longer own NFT #${id}.`);if(!await nft.isApprovedForAll(account,pool.target)){notice('Approve this staking contract to transfer your Fomo Chumz.');await receipt(await nft.connect(sig).setApprovalForAll(pool.target,true));}sig=await activeSigner(account);notice('Confirm staking in your wallet.');await receipt(await pool.connect(sig).stake(ids));}else{for(const id of ids)if((await pool.depositorOf(id)).toLowerCase()!==account.toLowerCase())throw Error(`NFT #${id} is not staked by your wallet.`);notice('Confirm withdrawal of your NFTs. Earned CHUMZ stays claimable after your timer.');await receipt(await pool.connect(sig).unstake(ids));}chosen.clear();}
function safeImage(url){if(typeof url!=='string')return '';if(url.startsWith('ipfs://'))url=C.ipfsGateway+url.slice(7).replace(/^ipfs\//,'');try{const u=new URL(url);return u.protocol==='https:'?u.href:'';}catch{return '';}}
async function metadata(id){try{const uri=safeImage(await nft.tokenURI(id));if(!uri)return '';const res=await fetch(uri,{signal:AbortSignal.timeout(7000)});if(!res.ok)return '';return safeImage((await res.json()).image);}catch{return '';}}
function renderInventory(){if(!$('inventory'))return;const data=inventoryTab==='wallet'?owned:staked;const box=$('inventory');box.replaceChildren();for(const [id,img]of data){const button=document.createElement('button');button.className='nft-card'+(chosen.has(id)?' selected':'');button.setAttribute('aria-pressed',String(chosen.has(id)));button.setAttribute('aria-label',`Select Fomo Chumz #${id}`);if(img){const image=document.createElement('img');image.src=img;image.alt=`Fomo Chumz #${id}`;image.loading='lazy';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();button.append(image);}const label=document.createElement('span');label.textContent=`CHUMZ #${id}`;button.append(label);button.onclick=()=>{chosen.has(id)?chosen.delete(id):chosen.add(id);renderInventory();};box.append(button);}if(!data.size){const empty=document.createElement('div');empty.className='empty-inventory';empty.innerHTML='<span class="empty-icon">◆</span>';const p=document.createElement('p');p.textContent=!configured?'Your Chumz will appear here after launch.':!state.address?'Connect your wallet to find your Chumz.':inventoryBusy?'Finding your Chumz…':'No NFTs loaded. Refresh or look up your NFT IDs below.';empty.append(p);box.append(empty);}text('wallet-nft-count',owned.size);text('staked-nft-count',staked.size);update();}
async function checkIds(ids,epoch){for(let i=0;i<ids.length;i+=12){const batch=await Promise.all(ids.slice(i,i+12).map(async id=>{try{const owner=(await nft.ownerOf(id)).toLowerCase();if(owner===state.address?.toLowerCase())return {id,type:'wallet'};if(owner===pool.target.toLowerCase()&&(await pool.depositorOf(id)).toLowerCase()===state.address?.toLowerCase())return{id,type:'staked'};}catch{}return null;}));if(epoch!==inventoryEpoch)return;for(const item of batch.filter(Boolean)){const map=item.type==='wallet'?owned:staked;map.set(String(item.id),'');metadata(item.id).then(img=>{if(epoch===inventoryEpoch&&map.has(String(item.id))){map.set(String(item.id),img);renderInventory();}});}renderInventory();}}
async function loadInventory(){if(!state.ready||!state.address||inventoryBusy)return;inventoryBusy=true;const epoch=++inventoryEpoch;owned.clear();staked.clear();chosen.clear();renderInventory();try{
 const ids=new Set();let params='?type=ERC-721';let pages=0;
 try{while(params&&pages++<50){const res=await fetch(`${C.explorerUrl}/api/v2/addresses/${state.address}/nft${params}`,{signal:AbortSignal.timeout(9000)});if(!res.ok)throw Error('Indexer unavailable');const data=await res.json();for(const item of data.items||[])if(item.token?.address_hash?.toLowerCase()===C.nftAddress.toLowerCase()||item.token?.address?.toLowerCase()===C.nftAddress.toLowerCase())ids.add(Number(item.id));params=data.next_page_params?'?'+new URLSearchParams(data.next_page_params):null;}}
 catch{text('inventory-help','Indexer unavailable. You can safely look up your NFT IDs below.');}
 if(Number.isInteger(C.deploymentBlock)&&C.deploymentBlock>0){const latest=await rpc.getBlockNumber();const filter=pool.filters.Staked(state.address);for(let from=C.deploymentBlock;from<=latest;from+=5000){if(epoch!==inventoryEpoch)return;const logs=await pool.queryFilter(filter,from,Math.min(from+4999,latest));for(const log of logs)ids.add(Number(log.args.tokenId));}}
 else if(state.staked>0)text('inventory-help',`You have ${state.staked} staked NFT(s). Enter their IDs below to load them.`);
 await checkIds([...ids].filter(id=>Number.isInteger(id)&&id>0&&id<=8888),epoch);
 }catch(e){text('inventory-help','Automatic lookup is unavailable. Enter NFT IDs below.');}finally{inventoryBusy=false;renderInventory();}}
async function lookup(){if(!state.ready||!state.address){openWallet();return;}const values=$('token-ids').value.trim().split(/[\s,]+/);if(!values.length||values.some(x=>!/^\d+$/.test(x)||Number(x)<1||Number(x)>8888)||values.length>100){text('inventory-help','Enter up to 100 valid NFT IDs between 1 and 8888, separated by commas.');return;}text('inventory-help','Checking ownership on Robinhood Chain…');await checkIds([...new Set(values.map(Number))],inventoryEpoch);text('inventory-help','Only NFTs owned or staked by your connected wallet are shown.');}
document.querySelectorAll('[data-connect]').forEach(b=>b.onclick=openWallet);
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
$('disconnect').onclick=async()=>{await wallet.disconnect();$('account-modal').close();await changed();};
$('switch-network').onclick=async()=>{try{await wallet.ensureChain();await changed();$('account-modal').close();}catch(e){notice(errorMessage(e),true);}};
$('notice-close').onclick=()=>$('notice').hidden=true;
for(const [key,id]of [['twitterUrl','twitter-link'],['openseaUrl','opensea-link']])document.querySelectorAll(`[data-social="${id}"]`).forEach(a=>{try{const url=new URL(C[key]);const host=url.hostname.toLowerCase();if(url.protocol!=='https:'||!(key==='twitterUrl'?['x.com','www.x.com','twitter.com','www.twitter.com'].includes(host):['opensea.io','www.opensea.io'].includes(host)))throw Error();a.href=url.href;a.removeAttribute('aria-disabled');a.title='';}catch{a.setAttribute('aria-disabled','true');a.title='Official collection link coming soon';a.onclick=e=>{e.preventDefault();notice('The official collection link will be added before launch.');};}});
if(page==='mint'){
 $('quantity').oninput=update;$('quantity').onblur=()=>{$('quantity').value=quantity();update();};
 $('minus').onclick=()=>{$('quantity').value=Math.max(1,quantity()-1);update();};$('plus').onclick=()=>{$('quantity').value=Math.min(100,quantity()+1);update();};
 document.querySelectorAll('[data-qty]').forEach(b=>b.onclick=()=>{$('quantity').value=b.dataset.qty;update();});$('mint-button').onclick=()=>transaction(mint);
}
if(page==='stake'){
 $('claim-button').onclick=()=>transaction(async account=>{const sig=await activeSigner(account);if(!await pool.canClaim(account))throw Error('Rewards are not ready. Check your 24-hour timer and earned balance.');notice('Confirm your CHUMZ claim.');await receipt(await pool.connect(sig).claim());});
 $('stake-button').onclick=()=>transaction(stakeAction);$('refresh-inventory').onclick=loadInventory;$('lookup-button').onclick=lookup;
 document.querySelectorAll('[data-inventory-tab]').forEach(b=>b.onclick=()=>{inventoryTab=b.dataset.inventoryTab;chosen.clear();document.querySelectorAll('[data-inventory-tab]').forEach(x=>x.classList.toggle('active',x===b));renderInventory();});
 $('select-all').onclick=()=>{const map=inventoryTab==='wallet'?owned:staked;if(chosen.size===map.size)chosen.clear();else{chosen.clear();[...map.keys()].slice(0,100).forEach(id=>chosen.add(id));}renderInventory();};renderInventory();
}
update();refresh();wallet.restore(changed).then(async s=>{if(s){Object.assign(state,{address:s.address,chainId:s.chainId});update();await refresh();if(page==='stake')loadInventory();}}).catch(e=>notice('Wallet service unavailable. '+errorMessage(e),true));
setInterval(()=>{if(!document.hidden&&!state.busy)refresh();},15000);setInterval(update,1000);
