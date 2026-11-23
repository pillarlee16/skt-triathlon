export const sports = ['swimming', 'cycling', 'running'] as const
export type Sport = typeof sports[number]
export const labels = {swimming:'수영', cycling:'사이클', running:'달리기'}
export const audioSlots = ['opening','countdown','start','bgm','item','obstacle','pass','finish','podium','ceremony','cheer','finishMusic'] as const
export const countdownMs = 3000
export const startLeadMs = 2500
export const podiumLeadMs = 1000
export const podiumTransitionMs = 8000
export const podiumIntervalMs = 3000
export const podiumHoldMs = 1000
export type Mode = 'live' | 'rehearsal'
export type Person = {id:string; name:string; team:string; photo:string; active:boolean; color?:string}
export type Asset = {id:string; name:string; kind:'image'|'audio'; targeted?:true}
export type Prize = {name:string; image:string}
export type Config = {
  title:string; names:Record<Sport,string>; duration:Record<Sport,number>
  captions:Record<Sport,string>; logo:string; starter:string
  podiumBackdrop?:string; stadiumAd?:string
  audio:Partial<Record<typeof audioSlots[number],string>>
}
export type Winner = {id:string; name:string; prize:string; image:string}
export type Race = {
  id:string; sport:Sport; seed:number; startsAt:number; endsAt:number
  winners:Winner[]; podiumAt?:number; completedAt?:number; finishers?:number; transitionMs?:number
  playbackVersion?:1|2
  invalidated?:{at:number; reason:string; redrawId?:string}
  redrawId?:string
  createdAt?:number
  eligibleCount?:number
}
export type State = {
  revision:number; mode:Mode; people:Person[]; prizes:Record<Sport,Prize>; assets:Asset[]
  config:Config; races:Race[]; ready?:{id:string; sport:Sport; redrawId?:string}
  current?:string
  pairing?:{hash:string; expires:number; readyId:string; used?:boolean} // Legacy SQLite snapshots
  locked:boolean; volume:{bgm:number; sfx:number; muted:boolean}
  raceTimingVersion?:1|2
  requests:Record<string,number>
}
export type Action =
  | {type:'prepare'; sport:Sport}
  | {type:'start'|'emergency'|'next'|'reset'}
  | {type:'redraw'; sport:Sport; reason:string}
  | {type:'savePerson'; id?:string; name:string}
  | {type:'removePerson'; id:string}
  | {type:'prizeNames'; names:Record<Sport,string>}
  | {type:'config'; config:Config}
  | {type:'assets'; assets:Asset[]; target?:{person:string}|{prize:Sport}}
  | {type:'removeAsset'; id:string}
  | {type:'volume'; volume:State['volume']}
export function initial(mode:Mode):State {
  return {
    revision:0, mode, people:[], assets:[],
    prizes:{swimming:{name:'',image:''},cycling:{name:'',image:''},running:{name:'',image:''}},
    config:{title:'SKT 철인3종 럭키드로우', names:{...labels}, duration:{swimming:30,cycling:30,running:30},
      captions:{swimming:'대형 파도! 선두권 대혼전',cycling:'과속방지턱! 선두권 대혼전',running:'쿠션 허들! 선두권 대혼전'},
      logo:'',starter:'',audio:{}},
    races:[],locked:false,volume:{bgm:.35,sfx:.7,muted:false},requests:{},raceTimingVersion:2
  }
}
export const preparationLocked=(s:Pick<State,'locked'|'races'>)=>s.locked||s.races.length>0
export const canPrepare=(s:Pick<State,'people'|'prizes'>)=>
  s.people.filter(p=>p.active).length>=9&&sports.every(k=>s.prizes[k].name.trim())
export const currentRace = (s:Pick<State,'races'|'current'>) => s.races.find(r=>r.id===s.current && !r.invalidated)
export const podiumStartAt = (race:Race) => race.podiumAt??(race.endsAt+(race.transitionMs??0))
export const podiumReadyAt = (race:Race) => podiumStartAt(race)+2*podiumIntervalMs+podiumHoldMs
export const podiumRevealed = (race:Race,now:number) => Math.max(0,Math.min(3,1+Math.floor((now-podiumStartAt(race))/podiumIntervalMs)))
export function stage(s:Pick<State,'races'|'current'|'ready'>, now:number) {
  const race = currentRace(s)
  if (race) {
    if (race.podiumAt !== undefined || now>=podiumStartAt(race)) return 'podium'
    if (now>=race.endsAt) return 'transition'
    if (now < race.startsAt) return 'countdown'
    return 'racing'
  }
  if (s.ready) return 'ready'
  return s.races.some(r=>r.sport==='running' && r.completedAt && !r.invalidated) ? 'complete' : 'setup'
}
export function findAsset(s:Pick<State,'assets'>, reference:string) {
  if (!reference) return undefined
  return s.assets.find(asset=>asset.id===reference) ??
    [...s.assets].reverse().find(asset=>!asset.targeted&&asset.name.normalize('NFC').toLowerCase()===reference.normalize('NFC').toLowerCase())
}
export function csv(s:State, now:number) {
  const cell = (value:string) => '"'+(/^[\s\u0000-\u001f]*[=+\-@\t\r]/.test(value) ? "'"+value : value).replaceAll('"','""')+'"'
  const rows = s.races.filter(r=>!r.invalidated && now>=r.endsAt)
    .flatMap(r=>r.winners.map((p,i)=>[labels[r.sport],String(i+1),p.id,p.name,p.prize]))
  return '\uFEFF'+[['종목','순위','참가번호','이름','상품명'],...rows].map(row=>row.map(cell).join(',')).join('\r\n')
}
