import {connectGoogle,disconnectGoogle} from './browser-api.js?v=975ec59d88f0';
let config,onConnected,client,ready=false;
function loadScript(src){return new Promise((resolve,reject)=>{const old=document.querySelector(`script[src="${src}"]`);if(old){if(old.dataset.loaded)return resolve();old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;}const el=document.createElement('script');el.src=src;el.async=true;el.onload=()=>{el.dataset.loaded='true';resolve();};el.onerror=()=>{el.remove();reject(new Error('Googleの接続画面を読み込めませんでした。'));};document.head.append(el);});}
export function configureGoogle(status,callback){config=status.google;onConnected=callback;ready=false;}
export function connectionMarkup(status){
 if(!status.sheetsConfigured)return '<strong>Google接続の初期設定前です</strong><p>デモはそのまま利用できます。Googleのアプリ登録が完了すると、ここから既存シートを選んで接続できます。JSON秘密鍵やシートの一般公開は不要です。</p>';
 if(status.connected)return `<strong>Google Sheetsに接続中</strong><p>接続期限 ${new Date(status.expiresAt).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo'})}。端末には実データや接続トークンを保存しません。</p><button class="quiet-button" id="google-disconnect">Google接続を解除</button>`;
 return '<strong>カレンダー用の既存シートに接続</strong><p>Googleの画面で許可し、使いたいカレンダー用シートを選択します。接続は最大1時間。ページを閉じると再接続が必要です。</p><button class="primary" id="google-prepare">Google接続を準備する</button><p id="google-message" role="status"></p>';
}
function message(text){const el=document.getElementById('google-message');if(el)el.textContent=text;}
function reopen(messageText){const dialog=document.getElementById('settings');if(!dialog.open)dialog.showModal();message(messageText);}
function selectSheet(response){
 let token=response.access_token;response.access_token='';const expiresIn=Number(response.expires_in);
 document.getElementById('settings').close();
 const view=new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setIncludeFolders(false).setSelectFolderEnabled(false);
 const picker=new google.picker.PickerBuilder().setAppId(config.appId).setDeveloperKey(config.pickerKey).setOAuthToken(token).setOrigin(location.origin).addView(view).setTitle('カレンダー用の既存シートを選択').setCallback(async result=>{
  if(result.action===google.picker.Action.CANCEL){token='';picker.dispose();reopen('シート選択をキャンセルしました。');return;}
  if(result.action!==google.picker.Action.PICKED)return;
  picker.setVisible(false);
  try{await connectGoogle({token,expiresIn,selectedSheetId:result.docs?.[0]?.id});token='';await onConnected();}
  catch(error){token='';reopen(error.message);}finally{picker.dispose();}
 }).build();picker.setVisible(true);
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.id==='google-prepare'){
  if(ready){client.requestAccessToken({prompt:'select_account'});return;}
  button.disabled=true;message('Googleの画面を準備しています…');
  try{
   await Promise.all([loadScript('https://accounts.google.com/gsi/client'),loadScript('https://apis.google.com/js/api.js')]);
   await new Promise((resolve,reject)=>gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('シート選択画面を読み込めませんでした。'))}));
   client=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:'https://www.googleapis.com/auth/drive.file',include_granted_scopes:false,callback:response=>{
    if(response.error||!google.accounts.oauth2.hasGrantedAllScopes(response,'https://www.googleapis.com/auth/drive.file')){message('接続は許可されませんでした。');return;}
    const permitted=new Set(['https://www.googleapis.com/auth/drive.file']);if(String(response.scope||'').split(' ').some(s=>s&&!permitted.has(s))){response.access_token='';message('許可範囲が広いため接続を停止しました。Googleの接続管理から以前の許可を取り消し、再接続してください。');return;}
    try{selectSheet(response);}catch{response.access_token='';reopen('シート選択画面を開けませんでした。Safariで再操作してください。');}
   },error_callback:()=>message('接続画面が閉じられたか、ポップアップがブロックされました。Safariで再操作してください。')});
   ready=true;button.textContent='Googleで接続してシートを選ぶ';message('準備できました。上のボタンを押してください。');
  }catch(error){message(error.message);}finally{button.disabled=false;}
 }
 if(button.id==='google-disconnect'){
  button.disabled=true;const revoked=await disconnectGoogle();await onConnected(false);if(!revoked)document.getElementById('connection-info').insertAdjacentHTML('beforeend','<p>端末内の接続は解除しました。Google側の許可取り消しは未確認です。<a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">Googleの接続管理</a>からも取り消せます。</p>');
 }
});
