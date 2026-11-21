import type {Person, Race} from './model.ts'

export function trackOrder(people:Person[],race:Race) {
  const noise=(id:string)=>{
    let h=race.seed
    for(const c of id) h=Math.imul(h^c.charCodeAt(0),16777619)
    return (h>>>0)/2**32
  }
  const winners=new Map(race.winners.map((w,i)=>[w.id,i]))
  return people.map((person,lane)=>({person,lane,rank:0,noise:noise(person.id),winner:winners.get(person.id)}))
    .sort((a,b)=>(a.winner??3)-(b.winner??3) || a.noise-b.noise || a.lane-b.lane)
    .map((runner,rank)=>({...runner,rank}))
}
export type Runner=ReturnType<typeof trackOrder>[number]
export function position(r:Runner,t:number) {
  const finish=r.rank<3 ? .958+r.rank*.021 : 1.045+r.rank*.0016
  const u=Math.max(0,t)
  const change=Math.sin(u*Math.PI)*(.12*(r.noise-.5))+
    Math.sin(u*Math.PI*2)*(.095*Math.sin(r.lane*7.13))-
    .085*Math.exp(-((u-.48)**2)/.005)*(r.lane%4===0?1:0)+
    .11*Math.exp(-((u-.59)**2)/.004)*(r.lane%7===2?1:0)
  const gate=Math.max(0,1-u/.9)
  return Math.min(u<finish?.9999:1.10, u/finish + change*gate)
}
