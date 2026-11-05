import {createDemo} from './demo.mjs';
import {normalize,yearItems} from './calendar.mjs';
import {BrowserSheets,validChange} from './browser-sheets.js';
import {googleConfig} from './site-config.js';
let accessToken='',expires=0,sheetId='',store=null,queue=Promise.resolve();
const completed=new Map();
const DEMO_KEY='koyomi-demo-v3';
const result=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json'}});
export function connectionStatus(){return {static:true,hosted:false,storage:'browser-demo',sheetsConfigured:Boolean(googleConfig.clientId&&googleConfig.pickerKey&&googleConfig.appId),connected:Boolean(accessToken&&expires>Date.now()),expiresAt:expires,google:{...googleConfig,sheetId},csrf:''};}
function token(){if(Date.now()>=expires){accessToken='';throw new Error('接続期限が切れました。Googleに再接続してください。');}return accessToken;}
export async function connectGoogle({token:given,expiresIn,selectedSheetId}){
 if(typeof given!=='string'||given.length<10||!Number.isFinite(Number(expiresIn))||Number(expiresIn)<60)throw new Error('接続許可を確認できませんでした。');
 const previous={accessToken,expires,sheetId,store};accessToken=given;expires=Date.now()+Math.min(Number(expiresIn),3600)*1000-30000;sheetId=selectedSheetId;store=new BrowserSheets({sheetId,tokenProvider:token});
 try{await store.read();}catch(error){({accessToken,expires,sheetId,store}=previous);throw error;}
}
export async function disconnectGoogle(){const value=accessToken;accessToken='';expires=0;sheetId='';store=null;completed.clear();if(!value)return true;try{const r=await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:value}),signal:AbortSignal.timeout(10000)});return r.ok;}catch{return false;}}
export function applyDemo(data,c){if(!validChange(c)||!/^DEMO-/.test(c.event_id))throw new Error('デモ以外のデータは端末へ保存しません。');const e=data.events.find(e=>e.event_id===c.event_id);if(!e)throw new Error('イベントが見つかりません。');if(c.kind==='favorite'){e.annual_favorite=c.value;return;}if(!data.occurrences.some(o=>o.occurrence_id===c.occurrence_id&&o.event_id===c.event_id)){const derived=yearItems({...data,events:data.events.map(e=>e.event_id===c.event_id?{...e,annual_favorite:true}:e)},Number(c.occurrence_id.slice(-4))).find(o=>o.occurrence_id===c.occurrence_id&&o.start_date);if(!derived)throw new Error('開催回が見つかりません。');data.occurrences.push(Object.fromEntries(['occurrence_id','event_id','year','start_date','end_date','date_status','source_url','basis'].map(k=>[k,derived[k]])));}let a=data.userActions.find(a=>a.occurrence_id===c.occurrence_id);if(!a){a={event_id:c.event_id,occurrence_id:c.occurrence_id};data.userActions.push(a);}a[c.field]=c.value;}
function demo(){const data=createDemo();let choices=[];try{choices=JSON.parse(localStorage.getItem(DEMO_KEY)||'[]');}catch{}if(!Array.isArray(choices))choices=[];for(const c of choices){try{applyDemo(data,c);}catch{}}return {data:normalize(data),choices};}
export async function apiFetch(path,options={}){
 try{
  const url=new URL(path,'https://local.invalid');
  if(url.pathname==='/api/status')return result(200,connectionStatus());
  if(url.pathname==='/api/data'){
   const mode=url.searchParams.get('mode');if(mode==='sheets'){token();if(!store)throw new Error('Googleへ接続してください。');return result(200,{mode,data:await store.read(),updatedAt:new Date().toISOString()});}if(mode!=='demo')throw new Error('データソースが正しくありません。');return result(200,{mode,data:demo().data,updatedAt:new Date().toISOString()});
  }
  if(url.pathname==='/api/change'&&options.method==='POST'){
   const c=JSON.parse(options.body);if(!['demo','sheets'].includes(c.mode)||!validChange(c)||typeof c.requestId!=='string')throw new Error('保存内容が正しくありません。');
   if(completed.has(c.requestId))return result(200,completed.get(c.requestId));
   const save=async()=>{if(completed.has(c.requestId))return completed.get(c.requestId);let saved;if(c.mode==='sheets'){token();if(!store)throw new Error('Googleへ再接続してください。');saved=await store.patch(c);}else{const current=demo();applyDemo(current.data,c);const choices=current.choices.filter(x=>!(x.kind===c.kind&&x.event_id===c.event_id&&(c.kind==='favorite'||x.occurrence_id===c.occurrence_id&&x.field===c.field)));choices.push(c);localStorage.setItem(DEMO_KEY,JSON.stringify(choices));saved={saved:true};}completed.set(c.requestId,saved);if(completed.size>100)completed.delete(completed.keys().next().value);return saved;};
   const operation=queue.then(save);queue=operation.catch(()=>{});return result(200,await operation);
  }
  return result(404,{error:'操作が見つかりません。'});
 }catch(error){return result(400,{error:error.message});}
}
