import {iso} from './calendar.mjs?v=975ec59d88f0';
export function createDemo() {
 const events=[], occurrences=[], userActions=[];
 const themes=[['小さな手しごと市','クラフト','作家と話しながら、木や布の手仕事に出会う。','所沢・手しごと広場'],['里山の自然観察会','自然','親子で森を歩いて、季節の生きものを探そう。','東村山・里山の森'],['まちの和太鼓体験','地域のお祭り','地域の人と一緒に、大人も子どもも音を楽しむ。','東村山・地域交流広場'],['陶器とガラスの小さな市','クラフト','一点ものの器と、つくり手の実演を楽しむ。','立川・ものづくり広場'],['親子の木工アトリエ','ものづくり','道具に触れて、家族で小さな作品をつくる。','小平・体験工房'],['農園の収穫マルシェ','マルシェ','土に触れる収穫体験と、旬の野菜の直売。','東久留米・市民農園'],['アートキャンパス公開日','アート・科学','学生の作品や制作風景に触れる特別な一日。','小平・アートキャンパス'],['星空と科学の教室','アート・科学','身近な不思議を実験で発見。大人にも新しい学び。','国分寺・科学のひろば']];
 for(let i=0;i<32;i++) {const t=themes[i%8]; events.push({event_id:`DEMO-${i}`,event_name:`${i<8?'': ['春の','夏の','秋の','冬の'][Math.floor(i/8)-1]}${t[0]}`,category:t[1],organizer:'デモ主催者',annual_favorite:[0,3,6,11].includes(i),venue:t[3],rationale:t[2],description:'画面と操作を確認するための架空のイベントです。実際には開催されません。',score:95-i%12*2,travel_minutes:20+i%5*8,fee_family:[0,1200,2000,3500][i%4],age:'小学生・幼児は保護者同伴（デモ）',parking:'未確認',rain_policy:'未確認',last_verified:'2026-11-03'});}
 for(let year=2025;year<=2027;year++) for(let m=1;m<=12;m++) {
   const first=new Date(Date.UTC(year,m-1,1)), saturday=1+(6-first.getUTCDay()+7)%7;
   for(let j=0;j<7;j++) {
     const id=(m*2+j)%32, day=j<3?saturday+7:j<5?saturday+15:j===5?Math.min(saturday+19,27):Math.min(saturday+21,28);
     occurrences.push({occurrence_id:`DEMO-${year}-${m}-${j}`,event_id:`DEMO-${id}`,year,start_date:iso(year,m,day),end_date:iso(year,m,day+(j===0?1:0)),date_status:year===2027&&j%3===0?'tentative_previous_date':'confirmed',basis:year===2027&&j%3===0?'デモ：前年実績の日付を参照':'',start_time:j===5?'':'10:00',end_time:j===5?'':'16:00',availability:'unverified',status:'active'});
   }
 }
 // One dense day checks 0/1/3/4/8 selected items and a long day panel.
 occurrences.splice(0,0,...Array.from({length:24},(_,i)=>({occurrence_id:`DEMO-dense-${i}`,event_id:`DEMO-${i}`,year:2026,start_date:'2026-11-14',end_date:i===0?'2026-11-15':'2026-11-14',start_time:i%4===0?'':`${String(9+i%7).padStart(2,'0')}:00`,end_time:'16:00',date_status:i===4?'tentative_previous_date':'confirmed',availability:'unverified',status:'active'})));
 userActions.push(...[0,4].map(i=>({event_id:`DEMO-${i}`,occurrence_id:`DEMO-dense-${i}`,want_to_go:true,skip:false,attended:false})));
 return {events,occurrences,userActions,sources:[],organizers:[]};
}
