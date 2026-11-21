import * as T from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import type {Sport} from './model.ts'
import type {Place, Station} from './venue-details.ts'

type Kit = {box:Place; tube:Place; ring:Place; ball:Place}
type Shade = (x:number,y:number,z:number,w:number,d:number,height:number)=>void

const ink=0x425367, cream=0xffecd3, teal=0x489f98, coral=0xe98570, ochre=0xe9b754
const metal=0x829293, wood=0xb38c70, dark=0x536172

function bench({box}:Kit,x:number,z:number,width=2.4){
  box(wood,x,.46,z,.65,.15,width)
  for(const offset of [-.39,.39])box(ink,x,.23,z+offset*width,.47,.45,.13)
}

function crate({box}:Kit,x:number,z:number,color:number,w=.67){
  box(color,x,w*.41,z,w,w*.82,w)
  box(cream,x,w*.84,z,w*1.025,.085,w*1.025)
  box(dark,x-w*.505,w*.54,z,.024,.086,w*.31)
}

function cart({box,tube}:Kit,x:number,z:number,color:number){
  for(const a of [-.30,.30])for(const b of [-.49,.49])
    tube(ink,x+a,.137,z+b,.25,.11,.25,0,0,Math.PI/2)
  box(color,x,.27,z,.84,.12,1.28)
  for(const a of [-.29,.29])box(metal,x+a,.51,z+.57,.072,.44,.072)
  box(metal,x,.77,z+.57,.67,.07,.072)
}

function table({box}:Kit,x:number,z:number,color:number){
  box(color,x,.98,z,.87,.15,2.44)
  for(const a of [-.31,.31])for(const b of [-.94,.94])
    box(dark,x+a,.46,z+b,.10,.92,.11)
}

function shelving({box}:Kit,x:number,z:number,color:number,height=1.68){
  for(const a of [-.31,.31])for(const b of [-1.03,1.03])
    box(color,x+a,height/2,z+b,.10,height,.11)
  for(const y of [.34,height*.54,height])
    box(color,x,y,z,.81,.11,2.24)
}

function instrument({box,tube}:Kit,x:number,z:number){
  const depth=.48
  for(const angle of [0,2.094,4.189]){
    const dx=Math.cos(angle),dz=Math.sin(angle)
    box(ink,x+dx*.21,.42,z+dz*.21,.071,.94,.075,depth*dz,0,-depth*dx)
    box(metal,x+dx*.42,.045,z+dz*.42,.15,.08,.16)
  }
  box(ink,x,.94,z,.62,.33,.54)
  tube(metal,x-.34,.96,z,.25,.14,.25,0,0,Math.PI/2)
  tube(teal,x-.43,.96,z,.14,.054,.14,0,0,Math.PI/2)
}

function swimProps(kit:Kit,zone:number){
  const {box,ring}=kit
  if(zone===0){
    shelving(kit,0,-.85,teal)
    for(let i=0;i<6;i++){
      const z=-1.66+i*.29
      box([ochre,coral,teal][i%3],-.08,.66,z,.52,.52,.12,0,0,-.12)
      box(cream,.01,1.13,z,.55,.15,.24)
    }
    bench(kit,-.53,1.71,1.77)
    crate(kit,.33,2.6,coral,.56)
  }else if(zone===1){
    shelving(kit,.32,-.25,0x6f877f,1.47)
    for(let slot=0;slot<4;slot++)
      ring([ochre,teal,coral,0x96b8ce][slot],.25,.81,-1+slot*.47,1,.94,.56,0,Math.PI/2)
    for(const z of [-1.85,1.32,2.38])box(wood,-.55,.46,z,.11,.92,.12)
    box(wood,-.55,.75,1.85,.09,.09,1.1)
    crate(kit,.35,1.76,ochre,.60)
    kit.tube(0xbf9073,.71,.28,2.58,.65,.55,.65)
    for(const [x,z,tilt] of [[.61,2.50,-.2],[.78,2.61,.2],[.71,2.73,-.27]])
      box(0x579b79,x,.69,z,.18,.41,.20,tilt,0,-tilt)
  }else{
    table(kit,.22,-.85,cream)
    box(ink,.10,1.18,-1.32,.42,.31,.65,0,0,.15)
    box(teal,-.09,1.19,-1.32,.04,.20,.53,0,0,.15)
    box(coral,.12,1.09,-.15,.41,.14,.48)
    cart(kit,.08,1.78,teal)
    for(let layer=0;layer<3;layer++)box(cream,.09,.40+layer*.13,1.77,.66,.11,.85)
    crate(kit,.52,3.0,0x8ab7b5,.61)
  }
}

function poolService(kit:Kit){
  const {box,tube,ring}=kit
  bench(kit,-.32,-1.34,2.0)
  for(const z of [-1.90,-1.24,-.67])box(cream,-.38,.55,z,.44,.072,.46)
  box(teal,.49,.45,.92,.95,.88,1.50)
  box(cream,.46,.89,.92,1.006,.16,1.56)
  for(const z of [.57,1.08,1.38])box(0xc4e1d7,-.005,.52,z,.034,.31,.30)
  for(const z of [-.20,2.02]){
    tube(wood,.67,.90,z,.12,1.8,.12)
    ring(z<0?coral:ochre,.58,1.24,z,.80,.80,.8,0,Math.PI/2)
  }
}

function streetProps(kit:Kit,zone:number){
  const {box,tube,ring}=kit
  if(zone===0){
    table(kit,.31,-.44,0xb19383)
    for(let i=0;i<3;i++){
      for(let pile=0;pile<2;pile++)box(cream,.27,1.10+pile*.10,-1.07+i*.70,.67,.086,.48)
      box(0xb2a2ae,.26,1.08,-1.07+i*.70,.69,.03,.08)
    }
    cart(kit,-.18,1.75,coral)
    crate(kit,-.18,1.62,wood,.61)
  }else if(zone===1){
    shelving(kit,.77,-.6,0x577976,1.54)
    for(const z of [-1.20,-.62,-.04]){
      box(ochre,.63,.51,z,.52,.22,.40)
      ring(0x607481,.67,1.20,z,.69,.70,.67,0,Math.PI/2)
    }
    for(let i=0;i<3;i++)ring(ink,.66,.48,1.15+i*.42,1,1,1,0,Math.PI/2)
    tube(coral,-.35,.51,2.3,.15,.91,.15)
    box(ink,-.35,1.0,2.3,.43,.082,.14)
    box(ink,-.35,.047,2.3,.31,.08,.27)
  }else{
    // Park the van lengthwise on the shoulder.
    for(const x of [-.70,.70])for(const z of [-1.10,1.13])
      tube(ink,x,.32,z,.59,.23,.59,0,0,Math.PI/2)
    box(teal,0,.76,0,1.53,.77,3.2)
    box(cream,0,1.25,-.35,1.51,1.05,2.42)
    box(0x587883,-.014,1.28,1.23,1.34,.58,.69,0,0,.026)
    box(cream,0,1.57,1.01,1.42,.19,.75)
    box(cream,-.77,1.03,-.38,.047,.22,1.17)
    for(const x of [-.50,.50])box(ochre,x,.72,1.62,.35,.15,.044)
    crate(kit,.72,-2.43,coral,.57)
    for(const z of [-3.35,2.75]){
      box(ink,0,.13,z,.72,.23,.15)
      box(cream,0,.55,z,1.47,.16,.11)
      for(const x of [-.49,0,.49])box(coral,x,.55,z-.063,.22,.16,.029)
    }
  }
}

function stadiumProps(kit:Kit,zone:number){
  const {box,tube}=kit
  if(zone===0){
    box(0x68a195,.43,.045,-.24,1.34,.075,2.77)
    for(let slot=0;slot<3;slot++){
      const z=-1.06+slot*.82
      box(ink,.27,.11,z,.82,.10,.20)
      box(cream,.10,.22,z,.32,.13,.36,0,0,.27)
      box(coral,.52,.22,z,.32,.13,.36,0,0,-.27)
    }
    cart(kit,.30,2.06,teal)
    crate(kit,.30,2.17,ochre,.55)
  }else if(zone===1){
    table(kit,.25,-.7,cream)
    for(let bottle=0;bottle<5;bottle++){
      const z=-1.53+bottle*.41
      tube(0x80babe,.21,1.21,z,.19,.35,.19)
      tube(cream,.21,1.411,z,.13,.055,.13)
    }
    box(ink,.22,.18,1.49,.86,.29,1.29)
    for(const z of [1.09,1.80]){
      box(dark,.20,.55,z,.69,.07,.12)
      for(const x of [-.10,.50])box(metal,x,.36,z,.08,.39,.10)
      box(ochre,.20,.69,z,.78,.15,.21)
    }
    box(ink,.66,.54,-2.28,.10,1.08,.10)
    box(teal,.58,1.12,-2.28,.12,.39,.59)
    box(cream,.509,1.12,-2.28,.028,.068,.38)
    box(cream,.509,1.18,-2.39,.028,.072,.18,.68)
  }else{
    instrument(kit,-.15,-1.57)
    table(kit,.42,.25,0xe7d2b4)
    box(ink,.13,1.17,.13,.41,.26,.64,0,0,.19)
    box(0x7fbebc,-.096,1.18,.13,.05,.15,.52,0,0,.19)
    bench(kit,.95,.23,1.32)
    crate(kit,.18,2.04,dark,.62)
    box(ink,.22,.062,2.61,1.59,.07,.23)
    for(const x of [-.27,.24,.74])box(ochre,x,.10,2.61,.16,.02,.23)
  }
}

function repairSupplies(kit:Kit){
  const {box,ring,tube}=kit
  crate(kit,.44,-1.05,ochre,.70)
  crate(kit,.37,.04,teal,.59)
  box(metal,.58,.16,1.04,.58,.29,.86)
  for(const z of [.76,1.20])ring(dark,.59,.50,z,1.10,1.0,.70,0,Math.PI/2)
  tube(cream,.12,.39,2.17,.42,.74,.42)
  box(coral,.12,.65,2.17,.43,.14,.44)
}

function storefrontBicycle(kit:Kit){
  const {box,ring,tube}=kit
  const frame=0xd4a653
  for(const z of [-.61,.61]){
    ring(ink,0,.39,z,.85,.85,.82,0,Math.PI/2)
    ring(cream,0,.39,z,.66,.66,.63,0,Math.PI/2)
    tube(0x879ba7,0,.39,z,.14,.15,.14,0,0,Math.PI/2)
  }
  box(frame,0,.45,-.27,.073,.071,.73,Math.PI*.17)
  box(frame,0,.70,-.03,.073,.071,.73,-.09)
  box(frame,0,.53,.24,.073,.071,.77,-Math.PI*.20)
  box(0x587484,0,.67,.51,.07,.69,.077,-.29)
  box(ink,-.02,1.011,.42,.29,.067,.08)
  box(ink,0,.83,-.24,.13,.082,.30)
  crate(kit,.29,1.51,teal,.64)
  crate(kit,.31,2.29,ochre,.60)
}

function hurdleCart(kit:Kit){
  const {box,tube}=kit
  cart(kit,.18,.12,teal)
  for(const z of [-.55,.77])box(metal,.18,.61,z,.083,.89,.086)
  for(let row=0;row<4;row++){
    box(ochre,.18,.43+row*.132,.11,.30,.10,1.42)
    box(cream,.015,.43+row*.132,.11,.045,.092,1.30)
  }
  tube(coral,.23,.25,1.07,.26,.34,.26)
  box(cream,.23,.29,1.07,.263,.06,.263)
}

function lifeguardSeat(kit:Kit){
  const {box,ring}=kit
  for(const z of [-.41,.41]){
    box(cream,.11,.96,z,.11,1.86,.10,0,0,-.13)
    box(cream,.71,.98,z,.10,1.89,.10,0,0,.12)
    box(coral,.69,1.47,z,.18,.13,.15)
  }
  for(let step=0;step<5;step++)box(teal,-.02+step*.047,.34+step*.245,0,.20,.073,.86)
  box(coral,.40,1.79,0,.77,.13,1.01)
  box(coral,.76,2.12,0,.12,.59,1.0)
  box(cream,.77,2.45,0,.15,.11,1.04)
  box(cream,.688,2.17,0,.031,.27,.085)
  box(cream,.688,2.17,0,.031,.086,.33)
  ring(ochre,.29,1.24,.57,.77,.83,.80)
}

function rescueBoards({box,ball}:Kit){
  for(const z of [-.98,.98]){
    box(wood,.26,.77,z,.17,1.49,.15)
    box(cream,.23,.12,z,.65,.14,.25)
  }
  box(teal,.26,.43,0,.35,.13,2.27)
  box(wood,.50,1.19,0,.13,.13,2.05)
  for(const [i,color] of [0xf1ac4c,0xf08274,0x63b6ba].entries()){
    const z=(i-1)*.62
    ball(color,.12,1.03,z,.23,1.72,.52,0,0,-.11)
    box(cream,-.008,1.07,z,.056,.19,.24,0,0,-.11)
    box(ink,-.040,1.07,z,.025,.068,.126,0,0,-.11)
  }
}

function printTrolley(kit:Kit){
  const {box,tube,ring}=kit
  cart(kit,.15,-.01,0x4598a8)
  box(ochre,-.278,.30,0,.045,.084,1.16)
  for(let i=0;i<3;i++){
    const z=-.48+i*.49
    const height=.76+i%2*.16
    tube(i===1?0xe2b682:cream,.13,.336+height/2,z,.33,height,.33)
    ring(wood,.13,.336+height,z,.196,.196,.25,Math.PI/2)
    tube(0x755e52,.13,.334+height,z,.104,.025,.104)
  }
  crate(kit,.26,1.22,ochre,.64)
  for(let layer=0;layer<3;layer++)box(layer===1?0xefb9a7:cream,.26,.66+layer*.075,1.23,.58,.066,.79)
}

function curbService({box,tube}:Kit){
  box(0x648383,.34,.165,0,1.18,.23,1.46)
  box(cream,.34,.29,0,1.22,.09,1.51)
  for(const z of [-.54,.54]){
    tube(0x435d74,.34,.82,z,.14,1.05,.14)
    tube(ochre,.34,1.30,z,.17,.14,.17)
  }
  box(0x5a8f91,.31,.83,0,.15,.55,1.24)
  box(cream,.22,.91,0,.029,.075,1.05)
  for(const z of [-.48,.04,.48])box(ochre,.21,.72,z,.065,.125,.096)
}

function broadcastCamera(kit:Kit){
  const {box,tube,ring}=kit
  for(const [x,z] of [[-.22,-.54],[.03,.53],[.64,-.12]]){
    const dx=.12-x,dy=.90,dz=-z
    const length=Math.hypot(dx,dy,dz)
    box(ink,(x+.12)/2,.53,z/2,.088,length,.088,Math.atan2(dz,dy),0,-Math.asin(dx/length))
    box(metal,x,.09,z,.19,.09,.18)
  }
  tube(metal,.12,.96,0,.21,.16,.21)
  box(0x465e74,.08,1.19,0,.61,.37,.41)
  tube(ink,-.29,1.20,0,.30,.30,.30,0,0,Math.PI/2)
  tube(0x74a6b5,-.46,1.20,0,.17,.055,.17,0,0,Math.PI/2)
  ring(0x9ab1a9,-.48,1.20,0,.28,.28,.28,0,Math.PI/2)
  box(0x354657,.11,1.25,.221,.31,.20,.052)
  box(0x80bcb1,.075,1.25,.254,.086,.06,.018)
  box(cream,.03,1.42,0,.30,.076,.14)
  box(coral,.13,1.46,0,.081,.044,.091)
  box(dark,-.28,.051,.47,.33,.07,.69)
  box(coral,.32,.22,.89,.28,.36,.34)
  box(cream,.32,.28,.89,.285,.067,.345)
}

function giftDisplay({box,ball,tube,ring}:Kit){
  box(cream,.16,.11,0,1.02,.18,1.24)
  for(const [x,z,h,color] of [[.10,-.24,.50,teal],[.30,.32,.34,coral]]){
    box(color,x,.20+h/2,z,.50,h,.54)
    box(color,x,.20+h,z,.54,.12,.57)
    box(ochre,x,.268+h,z,.105,.018,.55)
    box(ochre,x,.268+h,z,.54,.018,.105)
    box(ochre,x,.2+h/2,z+.272,.095,h,.025)
    for(const dz of [-.095,.095])ring(0xf5cf83,x,.331+h,z+dz,.226,.228,.25,.96)
    ball(0xf5cf83,x,.338+h,z,.12,.105,.12)
  }
  tube(0xe6b38c,.36,.28,-.74,.43,.43,.43,0,0,-.15)
  for(const [i,color] of [0xef9cb3,0xf2bf71,0xd3b9eb,cream,0xf0ae91].entries()){
    const z=-.94+i*.11
    box(0x65a584,.36,.53,z,.023,.39,.023,(i-2)*.16)
    ball(color,.36+(i%2)*.1,.71+(i%3)*.084,z,.238,.198,.224)
  }
}

function podiumMedallion({box,ball,ring}:Kit,sport:Sport){
  const color={swimming:0x67b8ca,cycling:0xbf9bd7,running:0xe97f91}[sport]
  box(cream,0,.052,0,1.30,.10,.68)
  box(color,0,.119,0,1.15,.07,.57)
  if(sport==='cycling'){
    ring(ochre,0,.47,0,.82,.82,.63)
    for(const angle of [0,Math.PI/3,-Math.PI/3])box(cream,0,.47,0,.038,.47,.033,0,0,angle)
    ball(cream,0,.47,.007,.12,.12,.093)
  }else if(sport==='swimming'){
    ring(color,0,.31,0,.95,.95,.8,.47)
    for(const side of [-1,1])ball(cream,side*.26,.31,0,.11,.14,.12)
  }else{
    for(const side of [-1,1])for(let i=0;i<3;i++)
      ball(ochre,side*(.20+i*.095),.32+i*.075,0,.19,.083,.098,0,0,side*.83)
    ball(color,0,.39,0,.26,.32,.16)
  }
}

type PropSetting=Sport|'podium'

export function addCourseProps(group:T.Group,sport:PropSetting,at:Station,shade:Shade,podiumSport?:Sport){
  const batch:Record<keyof Kit,number[][]>={box:[],tube:[],ring:[],ball:[]}
  // Place the full kit beyond the lane boundary and mirrored equipment at selected viewing points.
  const layout:Record<PropSetting,[number,number,(kit:Kit)=>void,number?][]> = {
    swimming:[
      [.106,-16.55,kit=>swimProps(kit,0),1.12],[.40,-17.2,kit=>swimProps(kit,1),1.19],
      [.93,-16.0,kit=>swimProps(kit,2),1.10],[.23,16.4,kit=>swimProps(kit,0)],[.82,17.0,kit=>swimProps(kit,1)],
      [.156,-18.1,poolService],[.457,-18.55,poolService,1.12],[.878,-17.1,poolService],[.18,16.0,poolService],
      [.18,-14.0,lifeguardSeat],[.449,-14.1,lifeguardSeat,1.22],[.865,14.4,lifeguardSeat,.9],
      [.135,-14.7,rescueBoards],[.538,-13.87,rescueBoards,1.18],[.831,14.5,rescueBoards],
    ],
    cycling:[
      [.095,-15.3,kit=>streetProps(kit,0),1.14],[.481,-14.96,kit=>streetProps(kit,1),1.16],
      [.93,-14.4,kit=>streetProps(kit,2)],[.21,15.0,kit=>streetProps(kit,0)],[.68,15.0,kit=>streetProps(kit,1)],
      [.118,14.4,repairSupplies],[.431,-14.8,repairSupplies],[.539,-14.6,repairSupplies],[.86,-14.55,repairSupplies],
      [.289,-15.45,storefrontBicycle],[.562,-15.53,storefrontBicycle],[.625,-15.32,storefrontBicycle],[.38,15.25,storefrontBicycle],
      [.10,-15.72,printTrolley],[.578,-13.72,printTrolley,1.36],[.91,14.65,printTrolley],
      [.155,-13.84,curbService],[.514,13.86,curbService,1.15],[.897,-13.55,curbService],
    ],
    running:[
      [.134,-12.49,kit=>stadiumProps(kit,0),1.08],[.378,-12.52,kit=>stadiumProps(kit,1),1.13],
      [.972,-12.71,kit=>stadiumProps(kit,2),1.1],[.26,12.45,kit=>stadiumProps(kit,0)],
      [.504,-12.63,kit=>stadiumProps(kit,1),.83],[.76,12.49,kit=>stadiumProps(kit,1)], [.864,12.61,kit=>stadiumProps(kit,2),.82],
      [.396,-12.63,hurdleCart],[.518,-12.66,hurdleCart],[.613,-12.71,hurdleCart],[.501,12.75,hurdleCart],
      [.115,-13,broadcastCamera],[.632,-12.61,broadcastCamera,1.26],[.923,13,broadcastCamera,.9],
    ],
    podium:[[.952,-5.80,giftDisplay,1.04],[.949,5.80,giftDisplay,.97]],
  }
  if(podiumSport){
    const ornament=(kit:Kit)=>podiumMedallion(kit,podiumSport)
    layout.podium.push([.944,-4.63,ornament],[.944,4.63,ornament])
  }
  const length=at(0).z-at(1).z
  for(const [progress,lane,build,scale=1] of layout[sport]){
    const p=at(progress,lane)
    const side=Math.sign(lane)
    const ground=sport==='swimming'?(Math.abs(lane)<=16.9?.075:.037):sport==='running'?.058:sport==='podium'?.305:.063
    const position=(dz:number)=>at(progress-dz/length,lane)
    let front=Infinity,back=-Infinity,left=Infinity,right=-Infinity
    let top=0
    function stamp(kind:keyof Kit):Place {
      return (color,x,y,z,w,h,d,rx=0,ry=0,rz=0)=>{
        const relative=sport==='cycling'?position(z*scale):p
        const worldX=relative.x+side*x*scale,worldZ=p.z+z*scale
        const halfX=(w*Math.abs(Math.cos(ry))+d*Math.abs(Math.sin(ry)))*scale/2
        const halfZ=(d*Math.abs(Math.cos(ry))+w*Math.abs(Math.sin(ry)))*scale/2
        left=Math.min(left,worldX-halfX);right=Math.max(right,worldX+halfX)
        front=Math.min(front,worldZ-halfZ);back=Math.max(back,worldZ+halfZ)
        top=Math.max(top,(y+h/2)*scale)
        batch[kind].push([color,worldX,relative.y+ground+y*scale,worldZ,
          w*scale,h*scale,d*scale,rx,ry*side,rz*side])
      }
    }
    build({box:stamp('box'),tube:stamp('tube'),ring:stamp('ring'),ball:stamp('ball')})
    const middleZ=(front+back)/2
    const shadowY=sport==='cycling'?position(middleZ-p.z).y:p.y
    shade((left+right)/2,shadowY+ground+.013,middleZ,(right-left)*1.25+.30,(back-front)*1.16+.36,
      Math.min(.62,top*.24))
  }
  const geometry={
    box:()=>new RoundedBoxGeometry(1,1,1,1,.082),
    tube:()=>new T.CylinderGeometry(.5,.5,1,10),
    ring:()=>new T.TorusGeometry(.37,.105,7,18),
    ball:()=>new T.SphereGeometry(.5,12,8)
  }
  const pose=new T.Object3D()
  const tint=new T.Color()
  for(const kind of ['box','tube','ring','ball'] as const){
    const items=batch[kind]
    if(!items.length)continue
    const mesh=new T.InstancedMesh(geometry[kind](),new T.MeshStandardMaterial({roughness:kind==='ring'?.46:.70}),items.length)
    items.forEach(([color,x,y,z,w,h,d,rx,ry,rz],i)=>{
      pose.position.set(x,y,z);pose.rotation.set(rx,ry,rz);pose.scale.set(w,h,d);pose.updateMatrix()
      mesh.setMatrixAt(i,pose.matrix)
      mesh.setColorAt(i,tint.setHex(color))
    })
    group.add(mesh)
  }
}
