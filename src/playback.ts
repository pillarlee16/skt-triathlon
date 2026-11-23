import type {Person, Race, Sport} from './model.ts'

export const raceBeats = {
  swimming: [
    {start:.20, end:.35, gate:.27, title:'상어 부캉이 등장! 물살을 타고 추월', sound:'item'},
    {start:.42, end:.60, gate:.49, title:'대형 파도! 선두권 대혼전', sound:'obstacle'},
    {start:.65, end:.80, gate:.72, title:'오리 튜브 등장! 물보라 속 추격', sound:'item'},
  ],
  cycling: [
    {start:.20, end:.35, gate:.27, title:'을지로 공사 구간! 콘 사이로 추월', sound:'obstacle'},
    {start:.42, end:.60, gate:.49, title:'과속방지턱! 선두권 대혼전', sound:'obstacle'},
    {start:.65, end:.80, gate:.72, title:'내리막 질주! 바깥쪽에서 추월', sound:'item'},
  ],
  running: [
    {start:.20, end:.35, gate:.27, title:'대형 응원공 등장! 안쪽 레인으로 추월', sound:'obstacle'},
    {start:.42, end:.60, gate:.49, title:'쿠션 허들! 선두권 대혼전', sound:'obstacle'},
    {start:.65, end:.80, gate:.72, title:'스퍼트 레인 점등! 마지막 추격', sound:'item'},
  ],
} as const

export const finishShotAt=.84
export const photoFinishAt=.80
export const finishHoldMs=720

// Reach the line on the original race clock while easing down over the last stretch.
export function photoFinishProgress(time:number) {
  const start=.94
  if(time<=start)return time
  const span=1-start
  const phase=(time-start)/span
  if(time<=1)return time+span*.40*phase**2*(1-phase)
  const after=time-1
  const recovery=Math.min(after,.04)
  return 1+.60*recovery+5*recovery**2+Math.max(0,after-.04)
}
export type Beat = {index:number; at:number; runner:Runner}
export type RaceEvent = {
  index:number; kind:'obstacle'|'item'; variant:number; at:number; appears:number; ends:number
  gate:number; lane:number; runnerId:string; strength:number; title:string
}
type Anchor = {time:number; distance:number}
export type Runner = {
  person:Person; lane:number; rank:number; finish:number; anchors:Anchor[]
  affected:boolean; events?:RaceEvent[]
}

const eventTitles = {
  swimming:{obstacle:['떠밀려 온 튜브','갑자기 밀려온 파도'],item:['물살 링 획득','급류 부스터 획득']},
  cycling:{obstacle:['공사 콘 접촉','이동식 바리케이드'],item:['가속 패드 획득','골드 부스터 획득']},
  running:{obstacle:['굴러온 응원공','쿠션 허들 착지'],item:['스퍼트 패드 획득','질주 부스터 획득']},
}

function noise(seed:number, id:string) {
  let value=seed
  for(const letter of id) value=Math.imul(value^letter.charCodeAt(0),16777619)
  value=Math.imul(value^(value>>>16),0x45d9f3b)
  return ((value^(value>>>16))>>>0)/2**32
}

const beatsByTime=[.17,.35,.58,.79]
const packBoundaries=[
  [20,46,70],[17,44,68],[16,41,66],[12,33,62],
]
const packOffsets:Record<Sport,number[][]>={
  swimming:[[.019,0,-.019,-.039],[.036,.008,-.020,-.050],[.044,.008,-.033,-.072],[.040,.015,-.013,-.046]],
  cycling:[[.020,.001,-.019,-.039],[.045,.011,-.028,-.064],[.034,.010,-.015,-.045],[.040,.014,-.013,-.050]],
  running:[[.019,0,-.020,-.040],[.033,.007,-.019,-.047],[.038,.010,-.016,-.054],[.040,.018,-.009,-.040]],
}
const sportSalt:Record<Sport,number>={swimming:0,cycling:1511,running:3037}

export function trackOrder(people:Person[],race:Race):Runner[] {
  if(race.playbackVersion)return itemRaceOrder(people,race)
  const winners=new Map(race.winners.map((winner,rank)=>[winner.id,rank]))
  const seed=race.seed+sportSalt[race.sport]
  const seeded=people.map((person,lane)=>({person,lane, winner:winners.get(person.id),
    draw:noise(seed,person.id), crowd:noise(seed,person.id+'crowd')}))
  const count=seeded.length
  const order=seeded.slice().sort((a,b)=>a.draw-b.draw||a.lane-b.lane)
  const curves=seeded.map(()=>[{time:0,distance:0}])
  const leaders=new Set<number>()
  const scale=(limits:number[])=>[0,...limits.map(limit=>Math.round(limit*count/90)),count]

  for(const [stage,time] of beatsByTime.entries()){
    const limits=scale(packBoundaries[stage])
    const previous=stage===0?limits:scale(packBoundaries[stage-1])
    let featured=order[0]
    if(stage>0){
      const moved=new Set<number>()
      for(let group=0;group<3;group++){
        const slots=(from:number,to:number)=>order.slice(from,to)
          .map((runner,i)=>({runner,index:from+i,score:noise(seed+stage*711+group*313,runner.person.id)}))
          .filter(slot=>!moved.has(slot.runner.lane))
          .sort((a,b)=>a.score-b.score||a.index-b.index)
        const upper=slots(previous[group],previous[group+1])
        const lower=slots(previous[group+1],previous[group+2])
        const swaps=Math.min(upper.length,lower.length,Math.max(1,Math.round(count*(group===2?.095:.069))))
        for(let i=0;i<swaps;i++){
          const a=upper[i],b=lower[i]
          order[a.index]=b.runner;order[b.index]=a.runner
          moved.add(a.runner.lane);moved.add(b.runner.lane)
          if(group===0&&!leaders.has(b.runner.lane)&&leaders.has(featured.lane))featured=b.runner
        }
      }
      // Give the new broadcast leader to someone who moved up or was holding in the chase.
      if(leaders.has(featured?.lane))featured=order.slice(0,limits[2]).find(r=>!leaders.has(r.lane))??featured
    }
    // A challenger from the back can make up ground before the final sprint begins.
    if(stage===3){
      for(const runner of seeded.filter(r=>r.winner!==undefined)){
        const rank=order.indexOf(runner)
        if(rank>=limits[3]&&limits[2]>limits[1]){
          const to=limits[1]+runner.winner!%Math.max(1,limits[2]-limits[1])
          ;[order[rank],order[to]]=[order[to],order[rank]]
        }
      }
    }
    if(featured){
      const current=order.indexOf(featured)
      if(current>0){
        order[current]=order[0]
        order[0]=featured
      }
      leaders.add(featured.lane)
    }
    for(let group=0;group<4;group++){
      const first=limits[group],last=limits[group+1]
      for(let i=first;i<last;i++){
        const width=stage===0?.013:group===0?.016:.017
        const depth=(i-first)/Math.max(1,last-first-1)
        curves[order[i].lane].push({time,distance:time+packOffsets[race.sport][stage][group]-depth*width})
      }
    }
  }
  const lastRanks=new Map(order.map((runner,rank)=>[runner.lane,rank]))
  const closingChasers=new Map(order.slice(Math.round(count*11/90),Math.round(count*23/90))
    .filter(runner=>runner.winner===undefined).slice(0,Math.round(count*2/90))
    .map((runner,index)=>[runner.lane,index]))
  const closingPlaces=new Map(order.filter(runner=>runner.winner===undefined)
    .sort((a,b)=>Number(!closingChasers.has(a.lane))-Number(!closingChasers.has(b.lane)))
    .slice(0,Math.max(0,(race.finishers??3)-3)).map((runner,index)=>[runner.lane,index]))
  return seeded.sort((a,b)=>(a.winner??3)-(b.winner??3)||a.draw-b.draw||a.lane-b.lane).map((runner,rank)=>{
    const closingPlace=closingPlaces.get(runner.lane)
    const finish=runner.winner!==undefined?(race.finishers===undefined?.958:.928)+runner.winner*.021:
      closingPlace!==undefined?1-((race.finishers??3)-4-closingPlace)*.004:1.045+rank*.0016
    const anchors=curves[runner.lane]
    const last=lastRanks.get(runner.lane)!
    const contender=last<Math.max(1,Math.round(count*5/90))
    const chase=closingChasers.get(runner.lane)
    const previous=anchors.at(-1)!.distance
    const closing=runner.winner!==undefined?[.904,.888,.896][runner.winner]:
      contender?.906-last*.003:chase!==undefined?.897-chase*.003:previous+.050
    anchors.push({time:.865,distance:Math.max(previous+.014,closing)})
    const runIn=runner.winner!==undefined?.938-runner.winner*.007:
      contender?.925-last*.003:chase!==undefined?.915-chase*.003:previous+.077
    anchors.push({time:.90,distance:Math.max(anchors.at(-1)!.distance+.015,runIn)})
    anchors.push({time:finish,distance:1})
    return {person:runner.person,lane:runner.lane,rank,finish,anchors,
      affected:runner.crowd<.50}
  })
}
const simulationSteps=300
const handoffStep=249
const handoff=handoffStep/simulationSteps

const finishes=[.980,.985,.991,1.004,1.016,1.023]
const photoOrders=[
  [[0,1,2,3,4,5],[0,1,2,3,5,4],[0,1,2,3,4,5],[0,1,2,3,4,5]],
  [[0,1,3,2,4,5],[0,1,2,3,4,5],[0,1,3,2,4,5],[0,1,3,2,5,4]],
  [[0,1,2,3,4,5],[1,0,3,4,2,5],[1,0,2,3,4,5],[1,0,3,2,4,5]],
]

function appendFinish(anchors:Anchor[],velocity:number,closing:Anchor[]) {
  const start=anchors[anchors.length-1]
  const first=closing[0]
  const blend=.025
  const speed=(first.distance-start.distance-velocity*blend/2)/(first.time-start.time-blend/2)
  anchors.push({time:handoff+blend/2,distance:start.distance+(velocity*3+speed)*blend/8},
    {time:handoff+blend,distance:start.distance+(velocity+speed)*blend/2},...closing)
}

export function eventForce(event:RaceEvent,time:number) {
  const phase=(time-event.at)/(event.ends-event.at)
  return phase>0&&phase<1?Math.sin(Math.PI*phase)**.75*event.strength:0
}

function itemRaceOrder(people:Person[],race:Race):Runner[] {
  if(!people.length)return []
  const seed=race.seed+sportSalt[race.sport]
  const winners=new Map(race.winners.map((winner,rank)=>[winner.id,rank]))
  const field=people.map((person,lane)=>({
    person,lane,rank:0,finish:0,affected:false,events:[] as RaceEvent[],
    anchors:[{time:0,distance:0}], distance:0, velocity:.94,leadSteps:0,
    pace:noise(seed,person.id), phase:noise(seed,person.id+'pace')*Math.PI*2,
  }))
  const order=field.slice()
  const paceBySport={swimming:.035,cycling:.049,running:.042}
  const gaps=Array.from({length:6},(_,index)=>.07+noise(seed,'event-time'+index)*.065)
  const eventSpan=.60+noise(seed,'event-span')*.028
  const gapTotal=gaps.reduce((sum,gap)=>sum+gap,0)
  const rounds=[.109+noise(seed,'first-event')*.047]
  for(const gap of gaps)rounds.push(rounds.at(-1)!+eventSpan*gap/gapTotal)
  const itemFirst=noise(seed,'item-first')<.5
  const kinds=rounds.map((_,index)=>(index%2===0)===itemFirst?'item' as const:'obstacle' as const)
  const swap=1+Math.floor(noise(seed,'item-order')*(rounds.length-3))
  ;[kinds[swap],kinds[swap+1]]=[kinds[swap+1],kinds[swap]]
  for(let step=1,eventIndex=0;step<=handoffStep;step++){
    const time=(step-1)/simulationSteps
    const leader=order[0].distance
    const spread=Math.min(1,time/.16)*Math.min(1,(.94-time)/.18)
    if(eventIndex<rounds.length&&time>=rounds[eventIndex]){
      const kind=kinds[eventIndex]
      const variant=Math.floor(noise(seed,'prop'+eventIndex)*2)
      const chase=eventIndex%3===1
      const from=kind==='obstacle'?0:chase?6:1
      const width=kind==='obstacle'?3:chase?9:5
      const options=order.slice(Math.min(from,order.length-1),from+width)
      const clear=options.filter(target=>!order.some(other=>other.lane%15===target.lane%15
        &&other.distance>target.distance&&other.distance-target.distance<.035))
      const candidates=clear.length?clear:options
      const leastInFront=Math.min(...candidates.map(candidate=>candidate.leadSteps))
      const fresh=candidates.filter(candidate=>candidate.leadSteps===leastInFront)
      const preferred=kind==='item'?fresh:candidates
      const laneRoll=noise(seed,'lane'+eventIndex)
      const target=kind==='obstacle'&&laneRoll<.68?preferred[0]:preferred[Math.floor(laneRoll*preferred.length)]
      const ends=Math.min(handoffStep/simulationSteps,time+.057+noise(seed,'effect-length'+eventIndex)*.023)
      const nearby=order[Math.min(order.length-1,order.indexOf(target)+3)]
      const effectiveTime=(ends-time)*.61
      const slowdown=Math.min(.70,Math.max(.145+variant*.035,(target.distance-nearby.distance)/effectiveTime+.105))
      const boost=Math.min(.89,Math.max(.34,(leader-target.distance)/effectiveTime+(chase?.27:.22)))
      target.events.push({index:eventIndex,kind,variant,at:time,
        appears:time-(clear.length?.031:.014),ends,gate:target.distance,
        lane:target.lane,runnerId:target.person.id,
        strength:kind==='obstacle'?-slowdown:boost,title:eventTitles[race.sport][kind][variant]})
      eventIndex++
    }
    for(const runner of field){
      const gap=leader-runner.distance
      const tempo=Math.sin(time*28+runner.phase)*paceBySport[race.sport]
      const preferredGap=(1-runner.pace)**1.65*.055*spread
      const draft=Math.min(.125,Math.max(0,gap-preferredGap-.008)*2.45)
      const action=runner.events.reduce((sum,event)=>sum+eventForce(event,time),0)
      const desired=.925+(runner.pace-.5)*.10+tempo+draft+action
      runner.velocity+=(desired-runner.velocity)*.43
      runner.distance+=runner.velocity/simulationSteps
      if(step%3===0||step===handoffStep)runner.anchors.push({time:step/simulationSteps,distance:runner.distance})
    }
    order.sort((a,b)=>b.distance-a.distance||b.pace-a.pace||a.lane-b.lane)
    order[0].leadSteps++
  }
  const photo=race.playbackVersion===2&&winners.size===3
  const finalists=order.filter(runner=>winners.has(runner.person.id))
    .sort((a,b)=>winners.get(a.person.id)!-winners.get(b.person.id)!)
  const followers=order.filter(runner=>!winners.has(runner.person.id))
  if(photo){
    for(let place=0;place<2;place++){
      const challenger=followers.findIndex((runner,index)=>index>=place&&index<8
        &&Math.abs(runner.lane%15-finalists[2].lane%15)>=2)
      if(challenger>place)followers.splice(place,0,...followers.splice(challenger,1))
    }
  }
  const finishOrder=[...finalists,...followers]
  const script=photoOrders[Math.floor(noise(seed,'photo-finish')*photoOrders.length)]
  const firstCenter=Math.max(.883,...finishOrder.slice(0,6).map(runner=>runner.distance+.013))
  return finishOrder.map((runner,rank)=>{
    const {person,lane,anchors,events,distance,velocity}=runner
    if(photo){
      const finish=finishes[rank]??(1.028+(rank-6)*.0029)
      const closing=rank<6?[
        {time:.885,distance:firstCenter-script[0].indexOf(rank)*.002},
        {time:.922,distance:.925-script[1].indexOf(rank)*.0023},
        {time:.952,distance:.960-script[2].indexOf(rank)*.0017},
        {time:.971,distance:.986-script[3].indexOf(rank)*.0018},
      ]:[{time:.885,distance:Math.max(distance+.022,Math.min(firstCenter-.015,distance+.050))},
        {time:.952,distance:Math.max(distance+.047,.930-Math.min(54,rank-6)*.0015)}]
      appendFinish(anchors,velocity,[...closing,{time:finish,distance:1}])
      return {person,lane,rank,finish,anchors,affected:false,events}
    }
    const winner=winners.get(person.id)
    const finish=winner===undefined?1.023+(rank-winners.size)*.0024:.958+winner*.021
    // Ease from the last simulated speed into a continuous run to the assigned finish.
    const blend=.027
    const closingSpeed=(1-distance-velocity*blend/2)/(finish-handoff-blend/2)
    const next=distance+(velocity+closingSpeed)*blend/2
    anchors.push({time:handoff+blend/2,distance:distance+(velocity*3+closingSpeed)*blend/8},
      {time:handoff+blend,distance:next},{time:finish,distance:1})
    return {person,lane,rank,finish,anchors,affected:false,events}
  })
}

export function raceEvents(runners:Runner[]):RaceEvent[] {
  return runners.flatMap(runner=>runner.events??[]).sort((a,b)=>a.index-b.index)
}

export function position(runner:Runner,time:number) {
  if(time<=0)return 0
  if(time>=runner.finish)return 1+(time-runner.finish)*.66
  let low=1,high=runner.anchors.length-1
  while(low<high){
    const mid=(low+high)>>>1
    if(runner.anchors[mid].time<time)low=mid+1
    else high=mid
  }
  const a=runner.anchors[low-1], b=runner.anchors[low]
  const t=(time-a.time)/(b.time-a.time)
  const blend=runner.events?t:.72*t+.28*t*t*(3-2*t)
  return a.distance+(b.distance-a.distance)*blend
}

export function cuePoints(sport:Sport,runners:Runner[]):Beat[] {
  if(!runners.length)return []
  return raceBeats[sport].map((beat,index)=>{
    const crossing=runners.map(runner=>{
      let low:number=beat.start, high:number=beat.end
      for(let i=0;i<14;i++){
        const mid=(low+high)/2
        if(position(runner,mid)>=beat.gate)high=mid
        else low=mid
      }
      return {runner,at:high,index}
    })
    return crossing.reduce((first,next)=>next.at<first.at?next:first)
  })
}
