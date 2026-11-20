export const sports = ['swimming', 'cycling', 'running'] as const
export type Sport = typeof sports[number]
export const labels = {swimming:'수영', cycling:'사이클', running:'달리기'}
export const audioSlots = ['opening','countdown','start','bgm','item','obstacle','pass','finish','podium'] as const
export type Mode = 'live' | 'rehearsal'
export type Person = {id:string; name:string; team:string; photo:string; active:boolean; color?:string}
export type Asset = {id:string; name:string; kind:'image'|'audio'}
export type Prize = {name:string; image:string}
export type Config = {
  title:string; names:Record<Sport,string>; duration:Record<Sport,number>
  captions:Record<Sport,string>; logo:string; starter:string
  audio:Partial<Record<typeof audioSlots[number],string>>
}
export type Winner = {id:string; name:string; prize:string; image:string}
export type Race = {
  id:string; sport:Sport; seed:number; startsAt:number; endsAt:number
  winners:Winner[]; podiumAt?:number; completedAt?:number
  invalidated?:{at:number; reason:string}
}
export type State = {
  revision:number; mode:Mode; people:Person[]; prizes:Record<Sport,Prize>; assets:Asset[]
  config:Config; races:Race[]; ready?:{id:string; sport:Sport}
  current?:string; pairing?:{hash:string; expires:number; readyId:string; used?:boolean}
  locked:boolean; volume:{bgm:number; sfx:number; muted:boolean}
  requests:Record<string,number>
}
export type Action =
  | {type:'prepare'; sport:Sport}
  | {type:'start'|'emergency'|'next'|'reset'|'disarm'}
  | {type:'redraw'; sport:Sport; reason:string}
  | {type:'import'; people:Person[]; prizes:Record<Sport,Prize>}
  | {type:'config'; config:Config}
  | {type:'assets'; assets:Asset[]}
  | {type:'removeAsset'; id:string}
  | {type:'volume'; volume:State['volume']}
  | {type:'arm'; hash:string; expires:number}
export function initial(mode:Mode):State {
  const rehearsal = mode === 'rehearsal'
  return {
    revision:0, mode, people:rehearsal ? Array.from({length:90}, (_,i)=>({
      id:String(i+1).padStart(2,'0'), name:'선수 '+String(i+1).padStart(2,'0'),
      team:['블루','오렌지','바이올렛'][i%3], photo:'', active:true
    })) : [], assets:[],
    prizes:{swimming:{name:rehearsal?'아쿠아 기프트':'',image:''},cycling:{name:rehearsal?'라이드 기프트':'',image:''},running:{name:rehearsal?'피니시 기프트':'',image:''}},
    config:{title:'SKT 철인3종 럭키드로우', names:{...labels}, duration:{swimming:45,cycling:45,running:45},
      captions:{swimming:'대형 파도! 선두권 대혼전',cycling:'트랙 장애물! 부스터 발동',running:'허들을 넘어 막판 스퍼트'},
      logo:'',starter:'',audio:{}},
    races:[],locked:false,volume:{bgm:.35,sfx:.7,muted:false},requests:{}
  }
}
export const currentRace = (s:Pick<State,'races'|'current'>) => s.races.find(r=>r.id===s.current && !r.invalidated)
export function stage(s:Pick<State,'races'|'current'|'ready'>, now:number) {
  const race = currentRace(s)
  if (race) {
    if (race.podiumAt !== undefined) return 'podium'
    if (now < race.startsAt) return 'countdown'
    if (now < race.endsAt) return 'racing'
    return 'finish'
  }
  if (s.ready) return 'ready'
  return s.races.some(r=>r.sport==='running' && r.completedAt && !r.invalidated) ? 'complete' : 'setup'
}
export function findAsset(s:Pick<State,'assets'>, reference:string) {
  if (!reference) return undefined
  return s.assets.find(asset=>asset.id===reference) ??
    [...s.assets].reverse().find(asset=>asset.name.normalize('NFC').toLowerCase()===reference.normalize('NFC').toLowerCase())
}
export function csv(s:State, now:number) {
  const cell = (value:string) => '"'+(/^[\s\u0000-\u001f]*[=+\-@\t\r]/.test(value) ? "'"+value : value).replaceAll('"','""')+'"'
  const rows = s.races.filter(r=>!r.invalidated && now>=r.endsAt)
    .flatMap(r=>r.winners.map((p,i)=>[labels[r.sport],String(i+1),p.id,p.name,p.prize]))
  return '\uFEFF'+[['종목','순위','참가번호','이름','상품명'],...rows].map(row=>row.map(cell).join(',')).join('\r\n')
}
