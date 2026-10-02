import {BrowserProvider} from 'ethers';
let modal=null,initializing=null,onChange=()=>{},raw=null;
const config=window.CHUMZ_CONFIG;
export const robinhoodChain={id:4663,caipNetworkId:'eip155:4663',chainNamespace:'eip155',name:'Robinhood Chain',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[config.rpcUrl]}},blockExplorers:{default:{name:'Robinhood Chain Explorer',url:config.explorerUrl}}};
async function initialize(){
 if(modal)return modal;if(initializing)return initializing;
 initializing=(async()=>{
  const [{createAppKit},{EthersAdapter}]=await Promise.all([import('@reown/appkit'),import('@reown/appkit-adapter-ethers')]);
  modal=createAppKit({adapters:[new EthersAdapter()],networks:[robinhoodChain],defaultNetwork:robinhoodChain,projectId:config.walletConnectProjectId,metadata:{name:'Fomo Chumz',description:'Mint and stake Fomo Chumz on Robinhood Chain',url:location.origin,icons:[location.origin+'/assets/favicon.svg']},themeMode:'dark',themeVariables:{'--w3m-accent':'#b9ff00','--w3m-border-radius-master':'2px'},features:{analytics:true,email:false,socials:[]}});
  const notify=()=>Promise.resolve(onChange()).catch(()=>{});
  modal.subscribeProviders(providers=>{raw=providers.eip155||null;notify();});
  modal.subscribeAccount(notify,'eip155');modal.subscribeNetwork(notify);
  return modal;
 })();
 try{return await initializing;}catch(e){initializing=null;throw e;}
}
export async function open(callback){onChange=callback;const m=await initialize();const s=await session();await m.open({view:s?'Account':'Connect'});}
export async function session(){
 if(!modal)return null;
 const account=modal.getAccount('eip155');
 if(!account?.isConnected||!account.address)return null;
 raw=modal.getWalletProvider()||raw;if(!raw)return null;
 const chainId=Number(await raw.request({method:'eth_chainId'}));
 return {address:account.address,chainId};
}
export async function ensureChain(){
 await initialize();let s=await session();if(!s)throw Error('Connect a wallet first.');
 if(s.chainId!==4663)await modal.switchNetwork(robinhoodChain);
 s=await session();if(s?.chainId!==4663)throw Error('Switch your wallet to Robinhood Chain.');
}
export async function signer(){await ensureChain();return new BrowserProvider(raw).getSigner();}
export async function restore(callback){onChange=callback;await initialize();return session();}
export async function disconnect(){if(modal)await modal.disconnect();raw=null;await onChange();}
