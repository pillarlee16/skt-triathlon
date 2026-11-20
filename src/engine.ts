import {randomInt, randomUUID} from 'node:crypto'
import {currentRace, findAsset, initial, sports, audioSlots, type Action, type State, type Race, type Sport} from './model.js'

export class RuleError extends Error {}
const requireRule: (ok:unknown, message:string)=>asserts ok = (ok,message)=>{
  if (!ok) throw new RuleError(message)
}
const validText = (value:unknown,max:number) => typeof value==='string' && value.length<=max
const nonempty = (value:unknown,max:number) => validText(value,max) && String(value).trim().length>0
const validSport = (sport:Sport) => sports.includes(sport)
const validLevel = (value:number) => Number.isFinite(value) && value>=0 && value<=1

export function apply(previous:State, action:Action, now:number, pick:(max:number)=>number=randomInt):State {
  const s = structuredClone(previous)
  const race = currentRace(s)
  switch(action.type) {
    case 'prepare': {
      requireRule(validSport(action.sport),'종목이 올바르지 않습니다.')
      requireRule(!race,'현재 경기를 먼저 마무리하세요.')
      const completed = s.races.filter(r=>r.completedAt && !r.invalidated)
      requireRule(sports[completed.length]===action.sport,'수영, 사이클, 달리기 순서로 진행하세요.')
      requireRule(s.people.filter(p=>p.active).length>=9,'참가자가 9명 이상 필요합니다.')
      requireRule(sports.every(k=>s.prizes[k].name.trim()),'세 종목 상품을 모두 등록하세요.')
      s.ready={id:randomUUID(),sport:action.sport}
      delete s.pairing
      break
    }
    case 'start':
    case 'emergency': {
      if (race && action.type==='emergency') {
        requireRule(race.podiumAt===undefined,'이미 발표 중입니다.')
        race.endsAt=Math.min(now,race.endsAt)
        race.podiumAt=now
        break
      }
      requireRule(!race && s.ready,'이미 시작했거나 준비된 경기가 없습니다.')
      const sport = s.ready.sport
      const excluded = new Set(s.races.filter(r=>!r.invalidated).flatMap(r=>r.winners.map(w=>w.id)))
      const pool = s.people.filter(p=>p.active && !excluded.has(p.id))
      requireRule(pool.length>=3,'추첨 대상이 부족합니다.')
      const prize=s.prizes[sport]
      const winners=Array.from({length:3},()=>{
        const [p]=pool.splice(pick(pool.length),1)
        return {id:p.id,name:p.name,prize:prize.name,image:findAsset(s,prize.image)?.id??''}
      })
      const emergency=action.type==='emergency'
      const startsAt=emergency ? now : now+4000
      const attempt:Race={id:randomUUID(),sport,seed:pick(2**31),startsAt,
        endsAt:emergency ? now : startsAt+s.config.duration[sport]*1000,winners}
      if (emergency) attempt.podiumAt=now
      s.races.push(attempt)
      s.current=attempt.id
      s.locked=s.mode==='live'
      delete s.ready
      delete s.pairing
      break
    }
    case 'next':
      requireRule(race && now>=race.endsAt,'결승 후 다음 화면으로 넘어갈 수 있습니다.')
      if (race.podiumAt===undefined) race.podiumAt=now
      else {
        requireRule(now>=race.podiumAt+4000,'발표가 끝날 때까지 기다려 주세요.')
        race.completedAt=now
        delete s.current
      }
      break
    case 'redraw': {
      requireRule(validSport(action.sport) && nonempty(action.reason,300),'재추첨 사유를 입력하세요.')
      requireRule(s.races.some(r=>r.sport===action.sport && !r.invalidated),'재추첨할 결과가 없습니다.')
      for(const r of s.races) {
        if (!r.invalidated && sports.indexOf(r.sport)>=sports.indexOf(action.sport)) {
          r.invalidated={at:now,reason:action.reason.trim()}
        }
      }
      delete s.current
      delete s.pairing
      s.ready={id:randomUUID(),sport:action.sport}
      break
    }
    case 'reset':
      requireRule(s.mode==='rehearsal','리허설만 초기화할 수 있습니다.')
      return {...initial('rehearsal'),revision:s.revision,requests:s.requests}
    case 'import':
      requireRule(!s.locked && !race,'현재 명단과 상품이 고정되어 있습니다.')
      requireRule(Array.isArray(action.people) && action.people.length<=180 && action.prizes,'명단 형식이 올바르지 않습니다.')
      requireRule(action.people.every(p=>p && nonempty(p.id,30) && nonempty(p.name,80) && validText(p.team,100) &&
        validText(p.photo,200) && typeof p.active==='boolean' && (p.color===undefined || /^#[0-9a-f]{6}$/i.test(p.color))), '참가자 필드를 확인하세요.')
      requireRule(new Set(action.people.map(p=>p.id)).size===action.people.length,'참가번호가 중복됩니다.')
      requireRule(sports.every(k=>nonempty(action.prizes[k]?.name,100) && validText(action.prizes[k]?.image,200)),'세 종목 상품을 모두 등록하세요.')
      s.people=action.people
      s.prizes=action.prizes
      delete s.ready
      delete s.pairing
      break
    case 'config': {
      const c=action.config
      requireRule(c && nonempty(c.title,100) && validText(c.logo,200) && validText(c.starter,200) &&
        sports.every(k=>nonempty(c.names?.[k],50) && validText(c.captions?.[k],150) &&
        Number.isInteger(c.duration?.[k]) && c.duration[k]>=15 && c.duration[k]<=120) &&
        c.audio && audioSlots.every(k=>c.audio[k]===undefined || validText(c.audio[k],200)), '방송 설정을 확인하세요. 경기 시간은 15~120초입니다.')
      requireRule(!race,'경기 진행 중에는 음량만 변경할 수 있습니다.')
      s.config=c
      break
    }
    case 'assets':
      requireRule(!race,'경기 진행 중에는 에셋을 변경할 수 없습니다.')
      s.assets.push(...action.assets)
      break
    case 'removeAsset':
      requireRule(!race && !s.locked,'본행사 시작 후에는 에셋을 해제할 수 없습니다.')
      s.assets=s.assets.filter(a=>a.id!==action.id)
      break
    case 'volume':
      requireRule(action.volume && validLevel(action.volume.bgm) && validLevel(action.volume.sfx) &&
        typeof action.volume.muted==='boolean','음향 설정이 올바르지 않습니다.')
      s.volume=action.volume
      break
    case 'arm':
      requireRule(s.ready,'먼저 경기를 준비하세요.')
      s.pairing={hash:action.hash,expires:action.expires,readyId:s.ready.id}
      break
    case 'disarm':
      delete s.pairing
      break
    default: throw new RuleError('지원하지 않는 요청입니다.')
  }
  return s
}
