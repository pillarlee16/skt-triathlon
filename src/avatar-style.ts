import type {Person} from './model.ts'

const palettes=[
  ['#4069d2','#9fe3f7'], ['#237b76','#ffc39f'], ['#55bba3','#f06264'],
  ['#764bb8','#f4cd58'], ['#a33870','#eac4f0'], ['#ef8061','#394570'],
  ['#69923d','#ffebb2'], ['#eba336','#287c88'], ['#e980ae','#802f58'],
  ['#536782','#ffad66'], ['#ce4955','#a8e3bd'], ['#b9a4e3','#52388e'],
] as const

export const costumeFamilies=[
  ['retro','pinwheel'], ['pit','post'], ['surf','coral'],
  ['trail','acorn'], ['wind','cloud'], ['quilt','hotteok'],
] as const
export type Costume=typeof costumeFamilies[number][number]
export type AvatarStyle={primary:string;accent:string;palette:number;pattern:number;gear:number;wrist:boolean;costume?:Costume}
export const starterStyle:AvatarStyle={primary:'#f43a65',accent:'#fff5d9',palette:-1,pattern:0,gear:0,wrist:false}

function idScore(id:string){
  let value=2166136261
  for(let i=0;i<id.length;i++)value=Math.imul(value^id.charCodeAt(i),16777619)
  value=Math.imul(value^(value>>>16),0x45d9f3b)
  return (value^(value>>>16))>>>0
}

function colorDistance(a:string,b:string){
  const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16)
  return Math.hypot((x>>16)-(y>>16),(x>>8&255)-(y>>8&255),(x&255)-(y&255))
}

export function assignAvatarStyles(people:readonly Person[]):Map<string,AvatarStyle>{
  const ordered=people.filter(p=>p.active).map(person=>({person,score:idScore(person.id)}))
    .sort((a,b)=>a.score-b.score||(a.person.id<b.person.id?-1:a.person.id>b.person.id?1:0))
  return new Map(ordered.map(({person},i)=>{
    const palette=i%palettes.length
    const set=Math.floor(i/palettes.length)
    const pattern=(set+palette)%4
    const gear=(Math.floor(set/4)+palette+pattern)%4
    const slot=(i+5*Math.floor(i/18))%18
    const costume=costumeFamilies[Math.floor(slot/3)][slot%3===2?1:0]
    const [base,trim]=palettes[palette]
    const saved=person.color&&/^#[0-9a-f]{6}$/i.test(person.color)?person.color:undefined
    const accent=saved&&colorDistance(saved,trim)<82?
      colorDistance(saved,base)>=82?base:colorDistance(saved,'#fff5df')>colorDistance(saved,'#26304b')?'#fff5df':'#26304b':trim
    return [person.id,{primary:saved??base,accent,palette,pattern,gear,wrist:(i+set)%3===0,costume}]
  }))
}
