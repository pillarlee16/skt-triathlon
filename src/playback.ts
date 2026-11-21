import type {Person, Race, Sport} from './model.ts'

export const raceBeats = {
  swimming: [
    {start:.20, end:.35, gate:.27, title:'상어 부캉이 등장! 물살을 타고 추월', sound:'item'},
    {start:.42, end:.60, gate:.49, title:'대형 파도! 선두권 대혼전', sound:'obstacle'},
    {start:.65, end:.80, gate:.72, title:'오리 튜브 등장! 물보라 속 추격', sound:'item'},
  ],
  cycling: [
    {start:.20, end:.35, gate:.27, title:'오르막에서 치고 나갑니다!', sound:'item'},
    {start:.42, end:.60, gate:.49, title:'과속방지턱! 선두권 대혼전', sound:'obstacle'},
    {start:.65, end:.80, gate:.72, title:'바람을 타고 추월!', sound:'item'},
  ],
  running: [
    {start:.20, end:.35, gate:.27, title:'안쪽 레인으로 추월!', sound:'item'},
    {start:.42, end:.60, gate:.49, title:'쿠션 허들! 선두권 대혼전', sound:'obstacle'},
    {start:.65, end:.80, gate:.72, title:'마지막 허들을 넘어 스퍼트!', sound:'item'},
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

export function trackOrder(people:Person[],race:Race) {
  const winners=new Map(race.winners.map((winner,rank)=>[winner.id,rank]))
  const seeded=people.map((person,lane)=>({person,lane, winner:winners.get(person.id),
    draw:noise(race.seed,person.id), crowd:noise(race.seed,person.id+'crowd')}))
  const provisional=seeded.filter(r=>r.winner===undefined).sort((a,b)=>a.draw-b.draw||a.lane-b.lane)
  const leaders=[provisional[0],provisional[1],provisional[2],provisional[3]]
  const nearLead=new Set(provisional.slice(0,8))
  return seeded.sort((a,b)=>(a.winner??3)-(b.winner??3)||a.draw-b.draw||a.lane-b.lane).map((runner,rank)=>{
    const finish=runner.winner===undefined?1.045+rank*.0016:.958+runner.winner*.021
    const anchors=[{time:0, distance:0}]
    for(const [index,time] of [.17,.35,.58,.79].entries()){
      const lead=leaders[index]??seeded[index%seeded.length]
      const offset=runner===lead?.057:nearLead.has(runner)?.008+.032*runner.crowd:
        runner.winner!==undefined?.014+.028*noise(race.seed+index,runner.person.id):-.083+.093*noise(race.seed+index,runner.person.id)
      anchors.push({time,distance:Math.max(anchors.at(-1)!.distance+.025,time+offset)})
    }
    anchors.push({time:.90,distance:runner.winner!==undefined?.938-runner.winner*.007:
      nearLead.has(runner)?.889+.033*runner.crowd:.826+.065*runner.crowd})
    const previous=anchors.at(-2)!
    anchors[anchors.length-1].distance=Math.max(anchors.at(-1)!.distance,previous.distance+.016)
    anchors.push({time:finish,distance:1})
    return {person:runner.person,lane:runner.lane,rank,finish,anchors,
      affected:runner===leaders[1]||runner.crowd<.50}
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
