import type {Place,Station} from './venue-details.ts'

const ivory=0xf8e5c1, sage=0x79b891, teal=0x4b9ba5, charcoal=0x546472

export function finishPool(at:Station,box:Place,ball:Place,
  shade:(x:number,y:number,z:number,w:number,d:number,height:number)=>void){
  const bayLength=(at(0).z-at(1).z)/24
  for(const side of [-1,1]){
    for(let i=0;i<=25;i++){
      const {x,z}=at((i-.35)/24,side*36.5)
      box(ivory,x,.52,z,.31,1.22,.37)
      box(0xffedce,x,1.16,z,.48,.15,.49)
      if(i===25)continue
      const center=z-bayLength/2
      for(const y of [.29,.87])box(ivory,x,y,center,.11,.10,bayLength)
      for(let j=1;j<8;j++)box(0xe5d3ac,x,.55,z-j*bayLength/8,.085,.62,.086)
      if(i%2===0){
        box(0xe0c09d,x-side*1.02,.12,center,1.40,.38,3.24)
        for(let j=0;j<5;j++){
          ball(j%2?sage:0x539273,x-side*1.02,.53,center+(j-2)*.59,1.33,.82,.91)
          if(j%2===i%3)ball(j%3?0xf09f84:0xffd489,x-side*1.26,.88,center+(j-2)*.59,.28,.19,.26)
        }
      }
      for(let j=0;j<3;j++){
        const width=2.1+(i+j)%3*.45
        ball(j%2?0x68aa79:0x8abd78,x+side*(1.36+j*.48),.56+(i+j)%3*.16,
          center+(j-1)*1.45,width,1.34+(i+j)%3*.32,2.04)
      }
    }
    for(const u of [.18,.31,.56,.74,.88]){
      const {x,z}=at(u,side*(u===.31||u===.56?17.9:21))
      const stripe=u===.56?0x409cae:u===.18||u===.74?0xd77f73:0x2e9ba0
      shade(x,.088,z,4.1,5.48,1.77)
      box(0xc2a78b,x,.12,z,3.0,.25,4.80)
      for(const dx of [-1.15,1.15])for(const dz of [-2.03,2.03]){
        const height=3.04-Math.abs(dx)*.26
        box(0xad8a68,x+dx,height/2,z+dz,.13,height,.13)
        box(ivory,x+dx,.125,z+dz,.25,.24,.25)
      }
      for(let strip=0;strip<10;strip++){
        const color=strip%2===0?0xffefda:stripe
        const panelZ=z+(strip-4.5)*.46
        for(const slope of [-1,1]){
          box(color,x+slope*.88,2.82,panelZ,1.86,.10,.466,0,0,-slope*.26)
          box(color,x+slope*1.78,2.46,panelZ,.093,.27,.46)
        }
      }
      for(const dz of [-2.15,2.15])box(0xb49572,x,2.50,z+dz,2.6,.13,.13)
      box(0xb88763,x,.68,z,1.60,.13,3.74)
      for(const dz of [-1.45,-.45,.55,1.45]){
        box(teal,x,.36,z+dz,1.19,.58,.34)
        for(let pile=0;pile<3;pile++)box(pile===1?0xb1d9d8:ivory,x-side*.25,.79+pile*.093,z+dz,.67,.086,.59)
      }
      box(0xe0c7aa,x+side*1.22,.25,z+1.7,1.0,.38,1.18)
      for(let i=0;i<4;i++)ball(i%2?sage:0x579b72,x+side*1.22,.56,z+1.36+i*.22,.68,.56,.50)
    }
  }
}

export function finishShop(box:Place,ball:Place,side:number,x:number,y:number,z:number,front:number,h:number,w:number,index:number){
  // Build up the roofline and shop bays using the same facade station as the shell.
  for(const dz of [-w*.47,w*.47])box(0xdfccad,x,y+h+.21,z+dz,10.2,.28,.19)
  box(0xdfccad,front,y+h+.21,z,.19,.28,w)
  const pipeZ=z+w*.36
  box(0x787d81,front-side*.30,y+h*.55,pipeZ,.10,h*.76,.12)
  box(0x787d81,front-side*.30,y+h*.70,z+.18,.11,.10,w*.66)
  const unitY=y+h*.72
  box(0xe3d6bf,front-side*.36,unitY,z-.86,.56,.60,.91)
  box(0x546474,front-side*.65,unitY,z-.86,.051,.34,.55)
  for(let vent=0;vent<5;vent++)box(0xc7c5bc,front-side*.69,unitY+(vent-2)*.063,z-.86,.024,.025,.57)
  for(const dz of [-w*.42,-w*.14,w*.14,w*.42]){
    box(0xbaad9a,front-side*.176,y+1.06,z+dz,.26,1.70,.12)
  }
  for(let floor=0;floor<Math.floor((h-2.4)/1.21);floor++){
    const level=y+3.06+floor*1.21
    for(const dz of [-2.13,0,2.13]){
      box(0xcfbcaa,front-side*.168,level-.42,z+dz,.19,.115,1.64)
      for(const jamb of [-.74,.74])box(0xcab9ae,front-side*.105,level,z+dz+jamb,.13,.83,.085)
      if(index%3===0)box(0x687e90,front-side*.15,level,z+dz-.12,.08,.76,.045)
    }
  }
  const display=front-side*1.07
  if(index%2===0){
    for(const dz of [.66,1.17,1.65]){
      ball(0x4a4c55,display,y+.39,z+dz,.74,.63,.47)
      ball(0x797d7e,display-side*.34,y+.39,z+dz,.09,.34,.26)
    }
  }else{
    for(const dz of [-1.76,1.33]){
      box(0xd5b783,display,y+.35,z+dz,.72,.58,.68)
      box(ivory,display,y+.65,z+dz,.77,.075,.73)
      box(0xf2ddbd,display-side*.365,y+.35,z+dz,.022,.12,.29)
    }
  }
}

export function finishStands(at:Station,box:Place,ball:Place){
  for(const side of [-1,1])for(let section=0;section<18;section++){
    const u=(section+.5)/18
    const aisle=section%4===1
    if(aisle){
      for(let row=0;row<6;row++){
        const p=at(u,side*(16.15+row*1.12))
        const top=.43+row*.48
        const z=p.z-2.03
        box(0xd6b578,p.x-side*.47,top+.127,z,.08,.024,1.24)
        for(const dz of [-.66,.66])box(0xd1d4c9,p.x,top+.38,z+dz,.063,.54,.063)
        for(const dz of [-.66,.66])box(0xd1d4c9,p.x+side*.53,top+.71,z+dz,1.2,.065,.065,0,0,side*.40)
      }
    }
    if(section%3===1){
      const p=at(u,side*13.94)
      box(0xdcc5a8,p.x,.23,p.z,.94,.38,2.19)
      for(let i=0;i<4;i++){
        const z=p.z+(i-1.5)*.48
        ball(i%2?sage:0x82ab7a,p.x,.55+(i%3)*.08,z,.77,.66,.74)
        if(i%2)ball(0xf8dd9f,p.x-side*.15,.91,z,.21,.13,.20)
      }
    }
    if(side===1)continue
    const back=at(u,-22.63)
    const width=5.98, height=1.52, diagonal=Math.hypot(width,height),angle=Math.atan2(height,width)
    for(const sign of [-1,1]){
      box(0xa8b7b6,back.x,4.18,back.z,.23,.19,diagonal,sign*angle)
    }
    box(charcoal,back.x+.14,4.10,back.z,.13,.25,.32)
    if(section%5===0){
      const p=at(u,-14.68)
      box(0x4f747c,p.x,.17,p.z,.73,.23,1.46)
      for(const dz of [-.5,.5])box(0x5b6875,p.x,.45,p.z+dz,.095,.63,.095)
      for(let i=0;i<4;i++)box(0xe5b777,p.x,.68+i*.15,p.z,.38,.10,1.38)
    }
  }
}
