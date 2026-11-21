import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import eventApi from '../api/event.ts'
const origin='http://localhost:5173'
const url=(op:string,mode='rehearsal')=>origin+'/api/event?op='+op+'&mode='+mode
const post=(op:string,body:unknown,headers:Record<string,string>={})=>eventApi.fetch(new Request(url(op),{
  method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)
}))
const state=(cookie:string,op='state')=>eventApi.fetch(new Request(url(op),{headers:{cookie}}))

test('authenticated rehearsal commits START and NEXT once, including delayed retries',async t=>{
  let now=Date.now()
  t.mock.method(Date,'now',()=>now)
  assert.equal((await state('')).status,401)
  assert.equal((await eventApi.fetch(new Request(url('state','live')))).status,403)
  const login=await post('login',{password:'rehearsal'})
  assert.equal(login.status,200)
  const cookie=login.headers.get('set-cookie')!.split(';')[0]
  const command=(type:string,revision:number,fields={})=>post('action',{type,...fields},{cookie,'x-revision':String(revision),'x-request-id':randomUUID()})
  assert.equal((await command('prepare',0,{sport:'swimming'})).status,200)
  assert.equal((await command('start',0)).status,409)
  const pair=await (await command('arm',1)).json()
  const authorization='Bearer '+pair.token
  const id=randomUUID()
  const tabletStart=()=>post('tabletStart',{}, {authorization,'x-request-id':id})
  const [tablet,admin]=await Promise.all([tabletStart(),command('start',2)])
  assert.equal([tablet,admin].filter(r=>r.ok).length,1)
  if(tablet.ok) assert.equal((await tabletStart()).status,200)
  else assert.equal((await tabletStart()).status,401)
  const publicTablet=await (await eventApi.fetch(new Request(url('tablet'),{headers:{authorization}}))).json()
  assert.deepEqual(publicTablet,{enabled:false})
  const before=await (await state(cookie)).json()
  assert.equal(before.races.length,1)
  assert.deepEqual(before.races[0].winners,[])
  const displayRequest=new Request(url('state')+'&view=display',{headers:{cookie}})
  const display=await (await eventApi.fetch(displayRequest)).json()
  assert.equal(display.current,before.current)
  assert.equal(display.races[0].winners.length,3)
  const revision=display.revision
  const nextId=randomUUID()
  const next=()=>post('action',{type:'next'},{cookie,'x-revision':String(revision),'x-request-id':nextId})
  assert.equal((await next()).status,400)
  now=display.races[0].endsAt
  const podium=await (await next()).json()
  assert.equal(podium.state.revision,4)
  assert.deepEqual(podium.state.races[0].winners,display.races[0].winners)
  assert.equal((await command('next',4)).status,400)
  now=podium.state.races[0].podiumAt+10000
  assert.equal((await (await next()).json()).state.revision,4)
  assert.equal((await command('next',4)).status,200)
  assert.equal((await (await next()).json()).state.ready.sport,'cycling')
  const after=await (await state(cookie)).json()
  assert.equal(after.races.length,1)
  assert.equal(after.races[0].winners.length,3)
  assert.equal((await (await state(cookie,'csv')).text()).split('\r\n').length,4)
})
