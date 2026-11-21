import {initial, sports} from '../src/model.ts'

export function fixture(){
  const state=initial('rehearsal')
  state.people=Array.from({length:90},(_,i)=>{
    const id=String(i+1).padStart(2,'0')
    return {id,name:'선수 '+id,team:'',photo:'',active:true}
  })
  for(const sport of sports)state.prizes[sport].name='테스트 상품'
  return state
}
