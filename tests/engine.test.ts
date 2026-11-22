import assert from 'node:assert/strict'
import {test} from 'node:test'
import {apply} from '../src/engine.ts'
import {initial,sports,csv,currentRace,stage,findAsset,podiumReadyAt,podiumRevealed,podiumIntervalMs,type State,type Sport} from '../src/model.ts'
import {cuePoints,position,raceBeats,trackOrder} from '../src/playback.ts'
import {fixture} from './fixture.ts'
const base=100000
function finish(s:State,sport:Sport,now:number) {
  const ready=s.ready?s:apply(s,{type:'prepare',sport},now)
  const result=apply(ready,{type:'emergency'},now+1,()=>0)
  return apply(result,{type:'next'},podiumReadyAt(currentRace(result)!))
}
test('90, 87, 84 eligible, nine unique winners, official CSV',()=>{
  let s=fixture()
  for(const [i,sport] of sports.entries()) {
    if(!s.ready)s=apply(s,{type:'prepare',sport},base+i*50000)
    assert.equal(s.ready?.sport,sport)
    const ranges:number[]=[]
    s=apply(s,{type:'start'},base+i*50000+1,max=>{ranges.push(max);return 0})
    assert.deepEqual(ranges.slice(0,3),[90-i*3,89-i*3,88-i*3])
    const race=currentRace(s)!
    assert.equal(race.endsAt-race.startsAt,20000)
    assert.equal(race.eligibleCount,90-i*3)
    const runners=trackOrder(s.people,race)
    assert.equal(runners.length,90)
    assert.equal(runners.filter(r=>position(r,1)>=1).length,10)
    assert.throws(()=>apply(s,{type:'next'},race.endsAt-1))
    assert.equal(stage(s,race.endsAt-1),'racing')
    assert.equal(stage(s,race.endsAt),'podium')
    const announced=race
    const at=race.endsAt
    assert.deepEqual([at-1,at,at+podiumIntervalMs,at+2*podiumIntervalMs].map(now=>podiumRevealed(announced,now)),[0,1,2,3])
    assert.throws(()=>apply(s,{type:'next'},podiumReadyAt(announced)-1))
    s=apply(s,{type:'next'},podiumReadyAt(announced))
  }
  assert.equal(new Set(s.races.flatMap(r=>r.winners.map(w=>w.id))).size,9)
  assert.equal(csv(s,base+150000).split('\r\n').length,10)
  assert.equal(stage(s,base+150000),'complete')
  const reset=apply(s,{type:'reset'},base+150000)
  assert.equal(stage(reset,base+150000),'ready')
  assert.equal(reset.ready?.sport,'swimming')
  assert.equal(reset.races.length,0)
  assert.equal(csv(reset,base+150000).split('\r\n').length,1)
  assert.deepEqual(reset.people,s.people)
  assert.deepEqual(reset.prizes,s.prizes)
  assert.deepEqual(reset.config,s.config)
  assert.deepEqual(reset.assets,s.assets)
  assert.throws(()=>apply(reset,{type:'reset'},base+150000))
  const replay=apply(reset,{type:'start'},base+150001,()=>0)
  assert.equal(currentRace(replay)?.eligibleCount,90)
})
test('earlier redraw atomically invalidates later results and recovers ready',()=>{
  let s=fixture()
  sports.forEach((sport,i)=>{s=finish(s,sport,base+i*9000)})
  s=apply(s,{type:'redraw',sport:'cycling',reason:'운영 정정'},base+30000)
  s=JSON.parse(JSON.stringify(s))
  assert.equal(s.races.filter(r=>r.invalidated).length,2)
  assert.equal(csv(s,base+30000).split('\r\n').length,4)
  assert.equal(s.ready?.sport,'cycling')
  s=apply(s,{type:'emergency'},base+31000,max=>max-1)
  assert.deepEqual(currentRace(s)?.winners.map(w=>w.id),['90','89','88'])
  assert.equal(currentRace(s)?.redrawId,s.races[1].invalidated?.redrawId)
})
test('double start rejects and emergency retains committed winners',()=>{
  const ready=apply(fixture(),{type:'prepare',sport:'swimming'},base)
  const running=apply(ready,{type:'start'},base,()=>0)
  assert.throws(()=>apply(running,{type:'start'},base))
  assert.throws(()=>apply(running,{type:'reset'},base))
  assert.equal(csv(running,base).split('\r\n').length,1)
  const podium=apply(running,{type:'emergency'},base+1)
  assert.deepEqual(currentRace(podium)?.winners,currentRace(running)?.winners)
  assert.equal(stage(podium,base+1),'podium')
})
test('exactly the expected runners cross before the end',()=>{
  const setup=apply(fixture(),{type:'prepare',sport:'swimming'},base)
  const started=apply(setup,{type:'start'},base)
  const race=currentRace(started)!
  const sorted=trackOrder(started.people,race)
  assert.equal(sorted.filter(r=>position(r,.9999)>=1).length,9)
  assert.equal(sorted.filter(r=>position(r,1)>=1).length,10)
  assert.deepEqual(sorted.filter(r=>position(r,.971)>=1).map(r=>r.person.id),race.winners.map(w=>w.id))
  assert.ok(sorted.every(r=>position(r,0)===0))
})
test('race animation seeds alter intermediate standings without changing draw or finish',()=>{
  const ready=apply(fixture(),{type:'prepare',sport:'swimming'},base)
  const first=apply(ready,{type:'start'},base,max=>max===2**31?42:Math.floor(max/3))
  const second=apply(ready,{type:'start'},base,max=>max===2**31?987654:Math.floor(max/3))
  const races=[currentRace(first)!,currentRace(second)!]
  assert.deepEqual(races[0].winners,races[1].winners)
  const standings=races.map(race=>trackOrder(ready.people,race))
  const top=(runners:typeof standings[number],progress:number)=>runners.slice()
    .sort((a,b)=>position(b,progress)-position(a,progress)).slice(0,5).map(r=>r.person.id)
  assert.notDeepEqual(top(standings[0],.52),top(standings[1],.52))
  for(const runners of standings)assert.deepEqual(runners.filter(r=>position(r,.971)>=1).map(r=>r.person.id),races[0].winners.map(w=>w.id))
})
test('direct preparation uses stable IDs and rejects edits after drawing',()=>{
  let state=initial('rehearsal')
  assert.throws(()=>apply(state,{type:'prepare',sport:'swimming'},base))
  for(let i=0;i<9;i++)state=apply(state,{type:'savePerson',name:'테스트'},base)
  assert.equal(new Set(state.people.map(p=>p.id)).size,9)
  assert.throws(()=>apply(state,{type:'prepare',sport:'swimming'},base))
  state=apply(state,{type:'prizeNames',names:{swimming:'A',cycling:'B',running:'C'}},base)
  state=apply(state,{type:'prepare',sport:'swimming'},base)
  const id=state.people[0].id
  state=apply(state,{type:'assets',assets:[{id:'original',name:'portrait.png',kind:'image'}]},base)
  state=apply(state,{type:'assets',assets:[{id:'direct',name:'portrait.png',kind:'image'}],target:{person:id}},base)
  assert.equal(state.ready,undefined)
  assert.equal(findAsset(state,'portrait.png')?.id,'original')
  assert.equal(findAsset(state,state.people[0].photo)?.id,'direct')
  state=apply(state,{type:'prepare',sport:'swimming'},base)
  state=apply(state,{type:'savePerson',id,name:'새 이름'},base)
  assert.equal(state.ready,undefined)
  assert.equal(state.people[0].id,id)
  state=apply(state,{type:'prepare',sport:'swimming'},base)
  state=apply(state,{type:'start'},base)
  assert.throws(()=>apply(state,{type:'removePerson',id},base))
  assert.throws(()=>apply(state,{type:'prizeNames',names:{swimming:'A',cycling:'B',running:'C'}},base))
})

test('three course stories change leaders and keep a deterministic photo finish',()=>{
  for(const sport of sports)for(const duration of [15,40,120])for(const seed of [0,17,42,91827,2147483647]){
    let state=fixture()
    const config=structuredClone(state.config)
    config.duration[sport]=duration
    state=apply(state,{type:'config',config},base)
    for(const prior of sports.slice(0,sports.indexOf(sport))) state=finish(state,prior,base-30000)
    const ready=state.ready?state:apply(state,{type:'prepare',sport},base)
    const race=currentRace(apply(ready,{type:'start'},base,max=>max===2**31?seed:Math.floor(max/3)))!
    const runners=trackOrder(state.people,race)
    assert.equal(race.endsAt-race.startsAt,duration*1000)
    const byPosition=(t:number)=>runners.slice().sort((a,b)=>position(b,t)-position(a,t))
    const checkpoints=[.17,.35,.58,.79]
    const limits=[[20,46,70],[17,44,68],[16,41,66],[12,33,62]]
    const stages=checkpoints.map(byPosition)
    assert.equal(new Set(stages.map(stage=>stage[0].person.id)).size,4)
    for(const [index,stage] of stages.entries()){
      for(const cut of limits[index]){
        assert.ok(position(stage[cut-1],checkpoints[index])-position(stage[cut],checkpoints[index])>=.005)
      }
      if(index>0){
        const oldBack=new Set(stages[index-1].slice(limits[index-1][2]))
        assert.ok(stage.slice(0,limits[index][2]).filter(runner=>oldBack.has(runner)).length>=4)
      }
    }
    const beforeSprint=new Set(stages[3].slice(0,10))
    assert.ok(byPosition(.865).slice(0,10).filter(runner=>!beforeSprint.has(runner)).length>=2)
    const cues=cuePoints(sport,runners)
    assert.deepEqual(cues,cuePoints(sport,trackOrder(state.people,structuredClone(race))))
    for(const [i,cue] of cues.entries()){
      const beat=raceBeats[sport][i]
      assert.ok(cue.at>=beat.start&&cue.at<beat.end)
      assert.ok(Math.abs(position(cue.runner,cue.at)-beat.gate)<.001)
    }
    for(const runner of runners){
      let previous=0
      for(let frame=0;frame<=duration*30;frame++){
        const distance=position(runner,frame/(duration*30))
        assert.ok(Number.isFinite(distance)&&distance>=previous)
        previous=distance
      }
    }
    for(const [i,t] of [.929,.95,.971].entries()){
      assert.deepEqual(runners.filter(r=>position(r,t)>=1).map(r=>r.person.id),
        race.winners.slice(0,i+1).map(w=>w.id))
    }
  }
})
