export const bool = v => v === true || String(v).toLowerCase() === 'true';
export const isPoc = e => /^POC/i.test(e.event_id) || /【.*テスト.*】/.test(e.event_name);
export const iso = (year, month, day) => `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
export function datesBetween(start, end = start) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return [];
  const a = new Date(start+'T00:00:00Z'), b = new Date(end+'T00:00:00Z'), result = [];
  if(!Number.isFinite(+a)||!Number.isFinite(+b)||a.toISOString().slice(0,10)!==start||b.toISOString().slice(0,10)!==end)return [];
  for (let d = a; d <= b && result.length < 732; d = new Date(+d + 86400000)) result.push(d.toISOString().slice(0,10));
  return result;
}
export function normalize(data) {
  const unique = (rows,key) => [...new Map((rows || []).filter(x=>x[key]).map(x=>[x[key],x])).values()];
  const actions=new Map();
  for(const action of data.userActions||[]){if(!action.occurrence_id)continue;const previous=actions.get(action.occurrence_id)||{};for(const [key,value] of Object.entries(action))if(value!==''&&value!=null)previous[key]=value;actions.set(action.occurrence_id,previous);}
  return {events:unique(data.events,'event_id').filter(e=>!isPoc(e)).map(e=>({...e,annual_favorite:bool(e.annual_favorite)})), occurrences:unique(data.occurrences,'occurrence_id'), userActions:[...actions.values()].map(a=>({...a,want_to_go:bool(a.want_to_go),skip:bool(a.skip),attended:bool(a.attended)})), sources:data.sources||[], organizers:data.organizers||[]};
}
export function yearItems(data, year) {
  const result = [], masters = new Map(data.events.map(e=>[e.event_id,e])), actions = new Map(data.userActions.map(a=>[a.occurrence_id,a]));
  for(const o of data.occurrences) {
    const e = masters.get(o.event_id); if(!e) continue;
    if (Number(o.year) !== year && !datesBetween(o.start_date,o.end_date||o.start_date).some(d=>d.startsWith(`${year}-`))) continue;
    result.push({...e,...o,action:actions.get(o.occurrence_id)||{},annual_favorite:bool(e.annual_favorite)});
  }
  for(const e of data.events.filter(e=>bool(e.annual_favorite))) {
    if(result.some(o=>o.event_id===e.event_id)) continue;
    const previous=data.occurrences.filter(o=>o.event_id===e.event_id && Number(o.year)<year && o.date_status==='confirmed' && o.start_date).sort((a,b)=>b.start_date.localeCompare(a.start_date))[0];
    if(!previous) {result.push({...e,year,occurrence_id:`undated:${e.event_id}:${year}`,date_status:'unverified',action:{},virtual:true});continue;}
    const start=`${year}${previous.start_date.slice(4)}`;
    const valid=new Date(start+'T00:00:00Z').toISOString().slice(0,10)===start;
    result.push({...e,year,occurrence_id:`tentative:${e.event_id}:${year}`,start_date:valid?start:undefined,end_date:valid?start:undefined,date_status:'tentative_previous_date',basis:`${previous.year}年の開催実績（${previous.start_date}）を参照`,source_url:previous.source_url,action:{},virtual:true});
  }
  return result;
}
export function eligible(item,{showSkipped=false,category='',query='',onlyWant=false,onlyFavorite=false,onlyAttended=false,showTentative=true}={}) {
  return !['cancelled','full','ineligible'].includes(item.status||item.availability) && !['cancelled','full','ineligible'].includes(item.date_status) && !['cancelled','full','ineligible'].includes(item.availability) && (showSkipped||!item.action.skip) && (showTentative||item.date_status==='confirmed') && (!category||item.category===category) && (!query||`${item.event_name} ${item.venue||''} ${item.rationale||''}`.toLowerCase().includes(query.toLowerCase())) && (!onlyWant||item.action.want_to_go) && (!onlyFavorite||item.annual_favorite) && (!onlyAttended||item.action.attended) && (item.score===''||item.score==null||Number(item.score)>=55);
}
export function rank(items) {return [...items].sort((a,b)=>Number(b.annual_favorite)-Number(a.annual_favorite)||Number(b.score||0)-Number(a.score||0)||a.event_name.localeCompare(b.event_name,'ja'));}
export function cellSummary(items) {
  const selected = items.filter(e=>e.action.want_to_go).sort((a,b)=>(a.start_time||'99:99').localeCompare(b.start_time||'99:99')||a.event_name.localeCompare(b.event_name,'ja'));
  return {names:(selected.length?selected:rank(items)).slice(0,3),selected:selected.length,overflow:Math.max(0,selected.length-3),total:items.length,unselected:items.length-selected.length};
}
export function dayMap(items) { const map = new Map(); for (const e of items) for(const date of datesBetween(e.start_date,e.end_date||e.start_date)) {if(!map.has(date)) map.set(date,[]); map.get(date).push(e);}return map; }
export function tableObjects(values) {const [headers=[],...rows]=values;return rows.filter(r=>r[0]).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));}
