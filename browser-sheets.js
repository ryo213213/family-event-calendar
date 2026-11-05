import {normalize,tableObjects,bool,yearItems,isPoc} from './calendar.mjs?v=975ec59d88f0';
const names=['Events','Occurrences','UserActions','Sources','Organizers'];
const headers={Events:['event_id','event_name','category','organizer','annual_favorite','last_verified'],Occurrences:['occurrence_id','event_id','year','start_date','date_status','source_url','availability'],UserActions:['event_id','occurrence_id','want_to_go','skip','attended','rating']};
export class BrowserSheets {
 constructor({sheetId,tokenProvider,fetcher=fetch}){if(!/^[A-Za-z0-9_-]{20,120}$/.test(sheetId))throw new Error('シートIDが正しくありません。');this.id=sheetId;this.tokenProvider=tokenProvider;this.fetcher=fetcher;this.queue=Promise.resolve();}
 async api(path,options={}){
  const token=this.tokenProvider();if(!token)throw new Error('Googleへ再接続してください。');
  let response;try{response=await this.fetcher(`https://sheets.googleapis.com/v4/spreadsheets/${this.id}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});}catch{throw new Error(options.method?'保存結果を確認できません。更新ボタンで状態を確認してから再操作してください。':'通信できません。接続を確認して更新してください。');}
  const result=await response.json();if(!response.ok){const messages={401:'Googleとの接続期限が切れています。再接続してください。',403:'このシートへの権限またはGoogle API設定を確認してください。',429:'Googleの利用上限です。少し待ってから操作してください。'};throw new Error(messages[response.status]||`Google Sheetsとの通信に失敗しました（${response.status}）。`);}return result;
 }
 async snapshot(){
  const query=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE'});for(const name of names)query.append('ranges',name+'!A1:Z1000');
  const result=await this.api('/values:batchGet?'+query);const tables={};
  for(let i=0;i<names.length;i++){const name=names[i],values=result.valueRanges?.[i]?.values||[];if(values.length>=1000)throw new Error('シートの読取上限に達しています。保存を停止しました。');if(headers[name]&&!headers[name].every((h,j)=>values[0]?.[j]===h))throw new Error(`${name}の列構成が違います。カレンダー用の既存シートを選んでください。`);tables[name]={values,rows:tableObjects(values)};}
  return {tables,data:normalize({events:tables.Events.rows,occurrences:tables.Occurrences.rows,userActions:tables.UserActions.rows,sources:tables.Sources.rows,organizers:tables.Organizers.rows})};
 }
 async read(){return (await this.snapshot()).data;}
 async patch(change){
  const run=()=>this.save(change);const operation=()=>globalThis.navigator?.locks?globalThis.navigator.locks.request('koyomi-sheet-'+this.id,run):run();
  const pending=this.queue.then(operation);this.queue=pending.catch(()=>{});return pending;
 }
 async save(c){
  if(!validChange(c))throw new Error('保存内容が正しくありません。');
  let snapshot=await this.snapshot();const event=snapshot.data.events.find(e=>e.event_id===c.event_id);if(!event||isPoc(event))throw new Error('対象のイベントが見つかりません。');
  if(['favorite','interest'].includes(c.kind)){
   const indexes=snapshot.tables.Events.values.flatMap((row,i)=>i>0&&row[0]===c.event_id?[i+1]:[]);if(indexes.length!==1)throw new Error('イベントIDが重複しています。データを確認してください。');
   if(c.kind==='favorite')await this.api('/values/'+encodeURIComponent(`Events!E${indexes[0]}`)+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({values:[[c.value]]})});
   else {
    const values=snapshot.tables.Events.values,head=values[0];
    if(head.filter(h=>h==='not_interested').length>1)throw new Error('興味なしの列が重複しています。保存を停止しました。');
    let column=head.indexOf('not_interested');const fresh=column<0;
    if(fresh){column=Math.max(...values.map(row=>row.length));if(column>=26)throw new Error('Eventsの読取範囲に空き列がありません。保存を停止しました。');}
    const letter=String.fromCharCode(65+column),parts=[{range:`Events!${letter}${indexes[0]}`,values:[[c.value]]}];
    if(fresh)parts.unshift({range:`Events!${letter}1`,values:[['not_interested']]});
    await this.api('/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:parts})});
   }
  }else{
   let occurrence=snapshot.data.occurrences.find(o=>o.occurrence_id===c.occurrence_id&&o.event_id===c.event_id);
   if(!occurrence&&c.occurrence_id.startsWith('tentative:')){
    const derived=yearItems(snapshot.data,Number(c.occurrence_id.slice(-4))).find(o=>o.occurrence_id===c.occurrence_id&&o.event_id===c.event_id&&o.virtual&&o.start_date);
    if(derived){await this.api('/values/'+encodeURIComponent('Occurrences!A:G')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',body:JSON.stringify({values:[[derived.occurrence_id,derived.event_id,derived.year,derived.start_date,'tentative_previous_date',derived.source_url||'','unverified']]})});snapshot=await this.snapshot();occurrence=snapshot.data.occurrences.find(o=>o.occurrence_id===c.occurrence_id&&o.event_id===c.event_id);}
   }
   if(!occurrence)throw new Error('開催回が見つかりません。更新して確認してください。');
   const indexes=snapshot.tables.UserActions.values.flatMap((row,i)=>i>0&&row[1]===c.occurrence_id?[i+1]:[]),column={want_to_go:'C',attended:'E',rating:'F'}[c.field];
   if(indexes.length){
    // Field-only writes preserve selections made by other family devices.
    await this.api('/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:indexes.map(i=>({range:`UserActions!${column}${i}`,values:[[c.value]]}))})});
   }else{
    // Blank fields mean untouched. Concurrent first saves can merge per field.
    const row=[c.event_id,c.occurrence_id,'','','',''];row[{want_to_go:2,attended:4,rating:5}[c.field]]=c.value;
    await this.api('/values/'+encodeURIComponent('UserActions!A:F')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',body:JSON.stringify({values:[row]})});
   }
  }
  const verified=await this.read();const actual=['favorite','interest'].includes(c.kind)?verified.events.find(e=>e.event_id===c.event_id)?.[c.kind==='favorite'?'annual_favorite':'not_interested']:verified.userActions.find(a=>a.occurrence_id===c.occurrence_id)?.[c.field];
  if(c.field==='rating'?Number(actual)!==c.value:bool(actual)!==c.value)throw new Error('別の端末の更新と競合しました。更新して状態を確認してください。');
  return {saved:true,data:verified};
 }
}
export function validChange(c){if(!c||typeof c.event_id!=='string'||c.event_id.length>150||/^POC/i.test(c.event_id))return false;if(['favorite','interest'].includes(c.kind))return typeof c.value==='boolean';return c.kind==='action'&&typeof c.occurrence_id==='string'&&c.occurrence_id.length<200&&(['want_to_go','attended'].includes(c.field)?typeof c.value==='boolean':c.field==='rating'&&Number.isInteger(c.value)&&c.value>=1&&c.value<=5);}
