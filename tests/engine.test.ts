import assert from 'node:assert/strict'
import {test} from 'node:test'
import {apply} from '../src/engine.ts'
import {initial,sports,csv,currentRace,stage,type State,type Sport} from '../src/model.ts'
import {position,trackOrder} from '../src/playback.ts'
import {parseRows} from '../src/import.ts'
const base=100000
function finish(s:State,sport:Sport,now:number) {
  const ready=apply(s,{type:'prepare',sport},now)
  const result=apply(ready,{type:'emergency'},now+1,()=>0)
  return apply(result,{type:'next'},now+4001)
}
test('90, 87, 84 eligible, nine unique winners, official CSV',()=>{
  let s=initial('rehearsal')
  for(const [i,sport] of sports.entries()) {
    s=apply(s,{type:'prepare',sport},base+i*5000)
    const ranges:number[]=[]
    s=apply(s,{type:'emergency'},base+i*5000+1,max=>{ranges.push(max);return 0})
    assert.equal(ranges[0],90-i*3)
    s=apply(s,{type:'next'},base+i*5000+4001)
  }
  assert.equal(new Set(s.races.flatMap(r=>r.winners.map(w=>w.id))).size,9)
  assert.equal(csv(s,base+20000).split('\r\n').length,10)
  assert.equal(stage(s,base+20000),'complete')
})
test('earlier redraw atomically invalidates later results and recovers ready',()=>{
  let s=initial('rehearsal')
  sports.forEach((sport,i)=>{s=finish(s,sport,base+i*5000)})
  s=apply(s,{type:'redraw',sport:'cycling',reason:'운영 정정'},base+20000)
  s=JSON.parse(JSON.stringify(s))
  assert.equal(s.races.filter(r=>r.invalidated).length,2)
  assert.equal(csv(s,base+20000).split('\r\n').length,4)
  assert.equal(s.ready?.sport,'cycling')
  s=apply(s,{type:'emergency'},base+21000,()=>0)
  assert.deepEqual(currentRace(s)?.winners.map(w=>w.id),['04','05','06'])
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
test('workbook preview identifies duplicate participant and missing prizes',()=>{
  const result=parseRows([
    ['참가번호','이름','조직','사진 파일명','참가 여부'],
    ['01','한','A','','참가'],['01','두','A','','참가']
  ],[['종목','상품명','이미지 파일명'],['수영','상품','']])
  assert.ok(result.errors.some(e=>e.includes('3행 중복')))
  assert.ok(result.errors.some(e=>e.includes('사이클')))
})
