import assert from 'node:assert/strict'
import {test} from 'node:test'
import {apply} from '../src/engine.ts'
import {initial,sports,csv,currentRace,stage,podiumReadyAt,podiumRevealed,podiumIntervalMs,type State,type Sport} from '../src/model.ts'
import {position,trackOrder} from '../src/playback.ts'
import {parseRows} from '../src/import.ts'
const base=100000
function finish(s:State,sport:Sport,now:number) {
  const ready=s.ready?s:apply(s,{type:'prepare',sport},now)
  const result=apply(ready,{type:'emergency'},now+1,()=>0)
  return apply(result,{type:'next'},podiumReadyAt(currentRace(result)!))
}
test('90, 87, 84 eligible, nine unique winners, official CSV',()=>{
  let s=initial('rehearsal')
  for(const [i,sport] of sports.entries()) {
    if(!s.ready)s=apply(s,{type:'prepare',sport},base+i*50000)
    assert.equal(s.ready?.sport,sport)
    const ranges:number[]=[]
    s=apply(s,{type:'start'},base+i*50000+1,max=>{ranges.push(max);return 0})
    assert.deepEqual(ranges.slice(0,3),[90-i*3,89-i*3,88-i*3])
    const race=currentRace(s)!
    assert.equal(race.endsAt-race.startsAt,40000)
    assert.equal(race.eligibleCount,90-i*3)
    const runners=trackOrder(s.people,race)
    assert.equal(runners.length,90)
    assert.deepEqual(runners.filter(r=>position(r,1)>=1).map(r=>r.person.id),race.winners.map(w=>w.id))
    assert.throws(()=>apply(s,{type:'next'},race.endsAt-1))
    s=apply(s,{type:'next'},race.endsAt)
    const announced=currentRace(s)!
    const at=announced.podiumAt!
    assert.deepEqual([at-1,at,at+podiumIntervalMs,at+2*podiumIntervalMs].map(now=>podiumRevealed(announced,now)),[0,1,2,3])
    assert.throws(()=>apply(s,{type:'next'},podiumReadyAt(announced)-1))
    s=apply(s,{type:'next'},podiumReadyAt(announced))
  }
  assert.equal(new Set(s.races.flatMap(r=>r.winners.map(w=>w.id))).size,9)
  assert.equal(csv(s,base+150000).split('\r\n').length,10)
  assert.equal(stage(s,base+150000),'complete')
})
test('earlier redraw atomically invalidates later results and recovers ready',()=>{
  let s=initial('rehearsal')
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
  const ready=apply(initial('rehearsal'),{type:'prepare',sport:'swimming'},base)
  const running=apply(ready,{type:'start'},base,()=>0)
  assert.throws(()=>apply(running,{type:'start'},base))
  assert.equal(csv(running,base).split('\r\n').length,1)
  const podium=apply(running,{type:'emergency'},base+1)
  assert.deepEqual(currentRace(podium)?.winners,currentRace(running)?.winners)
  assert.equal(stage(podium,base+1),'podium')
})
test('exactly the expected runners cross before the end',()=>{
  const setup=apply(initial('rehearsal'),{type:'prepare',sport:'swimming'},base)
  const started=apply(setup,{type:'start'},base)
  const race=currentRace(started)!
  const sorted=trackOrder(started.people,race)
  assert.deepEqual(sorted.filter(r=>position(r,1)>=1).map(r=>r.person.id),race.winners.map(w=>w.id))
  assert.deepEqual(sorted.filter(r=>position(r,.98)>=1).map(r=>r.person.id),race.winners.slice(0,2).map(w=>w.id))
})
test('race animation seeds alter intermediate standings without changing draw or finish',()=>{
  const ready=apply(initial('rehearsal'),{type:'prepare',sport:'swimming'},base)
  const first=apply(ready,{type:'start'},base,max=>max===2**31?42:Math.floor(max/3))
  const second=apply(ready,{type:'start'},base,max=>max===2**31?987654:Math.floor(max/3))
  const races=[currentRace(first)!,currentRace(second)!]
  assert.deepEqual(races[0].winners,races[1].winners)
  const standings=races.map(race=>trackOrder(ready.people,race))
  const top=(runners:typeof standings[number],progress:number)=>runners.slice()
    .sort((a,b)=>position(b,progress)-position(a,progress)).slice(0,5).map(r=>r.person.id)
  assert.notDeepEqual(top(standings[0],.52),top(standings[1],.52))
  for(const runners of standings)assert.deepEqual(runners.filter(r=>position(r,1)>=1).map(r=>r.person.id),races[0].winners.map(w=>w.id))
})
test('workbook preview identifies duplicate participant and missing prizes',()=>{
  const result=parseRows([
    ['참가번호','이름','조직','사진 파일명','참가 여부'],
    ['01','한','A','','참가'],['01','두','A','','참가']
  ],[['종목','상품명','이미지 파일명'],['수영','상품','']])
  assert.ok(result.errors.some(e=>e.includes('3행 중복')))
  assert.ok(result.errors.some(e=>e.includes('사이클')))
})
