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
export type Beat = {index:number; at:number; runner:Runner}

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

export function trackOrder(people:Person[],race:Race) {
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
  return seeded.sort((a,b)=>(a.winner??3)-(b.winner??3)||a.draw-b.draw||a.lane-b.lane).map((runner,rank)=>{
    const finish=runner.winner===undefined?1.045+rank*.0016:.958+runner.winner*.021
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
export type Runner=ReturnType<typeof trackOrder>[number]

export function position(runner:Runner,time:number) {
  if(time<=0)return 0
  if(time>=runner.finish)return Math.min(1.10,1+(time-runner.finish)*.66)
  const i=runner.anchors.findIndex(anchor=>anchor.time>=time)
  const a=runner.anchors[i-1], b=runner.anchors[i]
  const t=(time-a.time)/(b.time-a.time)
  const blend=.72*t+.28*t*t*(3-2*t)
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
