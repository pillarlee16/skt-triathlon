import {randomInt, randomUUID} from 'node:crypto'
import {currentRace, findAsset, preparationLocked, sports, stage, audioSlots, countdownMs, startLeadMs, podiumLeadMs, podiumTransitionMs, podiumReadyAt, type Action, type State, type Race, type Sport} from './model.ts'

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
      requireRule(!s.ready,'이미 준비된 경기입니다.')
      requireRule(s.people.filter(p=>p.active).length>=9,'참가자가 9명 이상 필요합니다.')
      requireRule(sports.every(k=>s.prizes[k].name.trim()),'세 종목 상품을 모두 등록하세요.')
      s.ready={id:randomUUID(),sport:action.sport}
      break
    }
    case 'start':
    case 'emergency': {
      if (race && action.type==='emergency') {
        requireRule(race.podiumAt===undefined&&now<race.endsAt,'이미 발표 중입니다.')
        race.endsAt=Math.min(now,race.endsAt)
        race.podiumAt=now+podiumLeadMs
        break
      }
      requireRule(!race && s.ready,'이미 시작했거나 준비된 경기가 없습니다.')
      const sport = s.ready.sport
      const excluded = new Set(s.races.filter(r=>!r.invalidated).flatMap(r=>r.winners.map(w=>w.id)))
      const pool = s.people.filter(p=>p.active && !excluded.has(p.id))
      requireRule(pool.length>=3,'추첨 대상이 부족합니다.')
      const eligibleCount=pool.length
      const prize=s.prizes[sport]
      const winners=Array.from({length:3},()=>{
        const [p]=pool.splice(pick(pool.length),1)
        return {id:p.id,name:p.name,prize:prize.name,image:findAsset(s,prize.image)?.id??''}
      })
      const emergency=action.type==='emergency'
      const startsAt=emergency ? now : now+startLeadMs+countdownMs
      const attempt:Race={id:randomUUID(),sport,seed:pick(2**31),startsAt,createdAt:now,redrawId:s.ready.redrawId,eligibleCount,
        endsAt:emergency ? now : startsAt+s.config.duration[sport]*1000,winners}
      if (emergency) attempt.podiumAt=now+podiumLeadMs
      else {
        attempt.transitionMs=podiumTransitionMs
        attempt.playbackVersion=2
      }
      s.races.push(attempt)
      s.current=attempt.id
      s.locked=true
      delete s.ready
      break
    }
    case 'next': {
      requireRule(race && now>=race.endsAt,'결승 후 다음 화면으로 넘어갈 수 있습니다.')
      requireRule(now>=podiumReadyAt(race),'발표가 끝날 때까지 기다려 주세요.')
      race.completedAt=now
      delete s.current
      const nextSport=sports[sports.indexOf(race.sport)+1]
      if(nextSport) s.ready={id:randomUUID(),sport:nextSport,redrawId:race.redrawId}
      break
    }
    case 'reset':
      requireRule(stage(s,now)==='complete','세 종목을 모두 마친 뒤 다시 시작할 수 있습니다.')
      s.races=[]
      delete s.current
      s.locked=false
      s.ready={id:randomUUID(),sport:'swimming'}
      break
    case 'redraw': {
      requireRule(validSport(action.sport) && nonempty(action.reason,300),'재추첨 사유를 입력하세요.')
      requireRule(s.races.some(r=>r.sport===action.sport && !r.invalidated),'재추첨할 결과가 없습니다.')
      const redrawId=randomUUID()
      for(const r of s.races) {
        if (!r.invalidated && sports.indexOf(r.sport)>=sports.indexOf(action.sport)) {
          r.invalidated={at:now,reason:action.reason.trim(),redrawId}
        }
      }
      delete s.current
      s.ready={id:randomUUID(),sport:action.sport,redrawId}
      break
    }
    case 'savePerson':
    case 'removePerson':
    case 'prizeNames': {
      requireRule(!preparationLocked(s),'첫 추첨 이후에는 준비 정보를 바꿀 수 없습니다.')
      if(action.type==='prizeNames'){
        requireRule(sports.every(k=>validText(action.names?.[k],100)),'상품명은 100자 이하로 입력하세요.')
        for(const sport of sports)s.prizes[sport].name=action.names[sport].trim()
      }else if(action.type==='savePerson'&&action.id===undefined){
        requireRule(nonempty(action.name,80)&&s.people.length<180,'이름은 80자 이하, 참가자는 최대 180명까지 등록할 수 있습니다.')
        s.people.push({id:randomUUID(),name:action.name.trim(),team:'',photo:'',active:true})
      }else{
        const index=s.people.findIndex(p=>p.id===action.id)
        requireRule(index>=0,'참가자를 찾을 수 없습니다.')
        if(action.type==='removePerson')s.people.splice(index,1)
        else{
          requireRule(nonempty(action.name,80),'이름을 80자 이하로 입력하세요.')
          s.people[index].name=action.name.trim()
        }
      }
      delete s.ready
      break
    }
    case 'config': {
      const c=action.config
      requireRule(c && nonempty(c.title,100) && validText(c.logo,200) && validText(c.starter,200) &&
        [c.podiumBackdrop,c.stadiumAd].every(ref=>ref===undefined || validText(ref,200)) &&
        sports.every(k=>nonempty(c.names?.[k],50) && validText(c.captions?.[k],150) &&
        Number.isInteger(c.duration?.[k]) && c.duration[k]>=15 && c.duration[k]<=120) &&
        c.audio && audioSlots.every(k=>c.audio[k]===undefined || validText(c.audio[k],200)), '방송 설정을 확인하세요. 경기 시간은 15~120초입니다.')
      requireRule(!preparationLocked(s),'첫 추첨 이후에는 음량만 변경할 수 있습니다.')
      s.config=c
      break
    }
    case 'assets': {
      requireRule(!preparationLocked(s),'첫 추첨 이후에는 파일을 변경할 수 없습니다.')
      if(action.target){
        const [asset]=action.assets
        requireRule(action.assets.length===1&&asset.kind==='image','이미지 파일을 선택하세요.')
        if('person' in action.target){
          const id=action.target.person
          const person=s.people.find(p=>p.id===id)
          requireRule(person,'참가자를 찾을 수 없습니다.')
          person.photo=asset.id
        }else{
          requireRule(validSport(action.target.prize),'종목이 올바르지 않습니다.')
          s.prizes[action.target.prize].image=asset.id
        }
        delete s.ready
        s.assets.push({...asset,targeted:true})
      }else s.assets.push(...action.assets)
      break
    }
    case 'removeAsset':
      requireRule(!preparationLocked(s),'본행사 시작 후에는 에셋을 해제할 수 없습니다.')
      s.assets=s.assets.filter(a=>a.id!==action.id)
      break
    case 'volume':
      requireRule(action.volume && validLevel(action.volume.bgm) && validLevel(action.volume.sfx) &&
        typeof action.volume.muted==='boolean','음향 설정이 올바르지 않습니다.')
      s.volume=action.volume
      break
    default: throw new RuleError('지원하지 않는 요청입니다.')
  }
  return s
}
