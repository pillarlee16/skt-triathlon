import * as T from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import type {Sport} from './model.ts'
import {raceBeats} from './playback.ts'
import {paintedPanel,panelLettering} from './scenery.ts'
import {floorNumbers,matteSurface,runningTrackSurface,shopSigns,stadiumCanopy} from './venue-details.ts'
import {contactTexture} from './avatar.ts'
import {addCourseProps} from './course-props.ts'
import {finishPool,finishShop,finishStands} from './venue-finish.ts'

export const world=160
export const courseColors={
  swimming:{sky:0x7bcef4,horizon:0xd7f4ec,ground:0xf4dfb3,road:0x2dafcb,line:0xeafffa,accent:0x287ec5},
  cycling:{sky:0x8cbbec,horizon:0xe6ecfd,ground:0xc2beb6,road:0x4a5469,line:0xfff3c9,accent:0x7356b9},
  running:{sky:0xffb99c,horizon:0xffe6c9,ground:0x88c6a4,road:0xe78a77,line:0xfff6e8,accent:0xca4c79},
  podium:{sky:0xffb9ae,horizon:0xffead0,ground:0xb2d8a5,road:0xe48979,line:0xfff5dd,accent:0xcf547a},
}
export function coursePoint(sport:Sport,distance:number,lane=0) {
  const u=T.MathUtils.clamp(distance,0,1)
  const x=sport==='cycling'?9*Math.sin(u*2*Math.PI)**2*Math.cos(u*2*Math.PI):
    sport==='running'?6*Math.sin(u*Math.PI)**2:0
  const y=sport==='cycling'?4*Math.sin(u*Math.PI)**2:0
  return {x:x+lane,y,z:-world*distance}
}

export function buildCourse(group:T.Group,sport:Sport,podium:boolean,keyDirection:T.Vector3,art?:HTMLImageElement){
  const palette=courseColors[podium?'podium':sport]
  let regularBoard:T.Mesh|undefined,sprintBoard:T.Mesh|undefined
  const boxes:number[][]=[]
  const balls:number[][]=[]
  const shadows:number[][]=[]
  const stamp=(batch:number[][],color:number,x:number,y:number,z:number,w:number,h:number,d:number,rx=0,ry=0,rz=0)=>{
    batch.push([color,x,y,z,w,h,d,rx,ry,rz])
  }
  const box=stamp.bind(null,boxes), ball=stamp.bind(null,balls)
  const at=(u:number,lane=0)=>coursePoint(sport,u,lane)
  const cream=0xffedc8
  const shadeX=-keyDirection.x/keyDirection.y, shadeZ=-keyDirection.z/keyDirection.y
  // Match the offset of the soft silhouettes to the key light in the track scene.
  const shade=(x:number,y:number,z:number,w:number,d:number,height:number)=>{
    const targetZ=z+shadeZ*height
    const banked=sport==='cycling'&&!podium
    const slope=banked?at(-targetZ/world+.01).y-at(-targetZ/world-.01).y:0
    const lift=banked?at(-targetZ/world).y-at(-z/world).y:0
    shadows.push([x+shadeX*height,y+lift,targetZ,w,d,Math.atan2(slope,world*.02)])
  }
  const tree=(x:number,z:number,size:number)=>{
    box(0xa78976,x,size*.62,z,.29*size,1.24*size,.32*size)
    ball(0x559f89,x,size*1.73,z,1.42*size,1.67*size,1.38*size)
    ball(0x92c98f,x+.38*size,size*1.94,z-.15*size,1.08*size,1.10*size,1.1*size)
  }
  const palm=(x:number,z:number,size:number,lean:number)=>{
    shade(x,-.192,z,1.4*size,1.6*size,.18)
    shade(x+lean*size,-.191,z,3.7*size,2.7*size,1.45*size)
    for(let level=0;level<5;level++){
      box(level%2?0xa77951:0xb68b63,x+lean*size*level/5,(.34+level*.63)*size,z,
        (.38-level*.031)*size,.69*size,.35*size,0,0,-lean*.23)
    }
    for(let branch=0;branch<7;branch++){
      const a=branch*Math.PI*2/7
      ball(branch%2?0x49b67b:0x278d68,x+lean*size*.86+Math.cos(a)*size*.83,3.04*size,z+Math.sin(a)*size*.83,
        2.0*size,.27*size,.62*size,0,-a,-.24)
    }
    ball(0xe7b45d,x+lean*size*.83,2.9*size,z,.43*size,.37*size,.39*size)
  }
  const pennants=(u:number, span:number, lift=0)=>{
    const {x,y,z}=at(u)
    const colors=[palette.accent,cream,0xf4a8b8,0x81c9b6]
    const rope:number[]=[]
    const folds:number[][]=colors.map(()=>[])
    const sag=(dx:number)=>6.15+lift+(dx/(span/2))**2*.78
    for(let i=0;i<=32;i++){
      const dx=(i/32-.5)*span
      rope.push(x+dx,y+sag(dx),z)
    }
    group.add(new T.Line(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(rope,3)),new T.LineBasicMaterial({color:0x735c66})))
    for(let i=0;i<15;i++){
      const offset=(i-7)*span/14
      const a=[x+offset-.35,y+sag(offset-.35),z]
      const b=[x+offset+.35,y+sag(offset+.35),z]
      const tip=[x+offset+.08,y+sag(offset)-.52,z+.11*Math.cos(i)]
      const crease=[x+offset,y+sag(offset)-.024,z+.115*Math.sin(i*2.3)]
      folds[i%4].push(...a,...crease,...tip,...crease,...b,...tip)
    }
    folds.forEach((points,i)=>{
      const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points,3))
      geometry.computeVertexNormals()
      group.add(new T.Mesh(geometry,new T.MeshStandardMaterial({color:colors[i],side:T.DoubleSide})))
    })
    for(const side of [-1,1]){
      const height=sag(span/2)
      box(0x8c8994,x+side*span/2,y+height/2,z,.095,height,.095)
    }
  }
  function ribbon(left:number,right:number,height:number,color:number){
    const points:number[]=[], triangles:number[]=[]
    const slices=sport==='swimming'?218:120
    for(let i=0;i<=slices;i++){
      const u=-.07+i*(podium?1.14:1.37)/slices
      const a=at(u,left), b=at(u,right)
      points.push(a.x,a.y+height,a.z,b.x,b.y+height,b.z)
      if(i){const n=i*2;triangles.push(n-2,n-1,n,n-1,n+1,n)}
    }
    const geo=new T.BufferGeometry()
    geo.setAttribute('position',new T.Float32BufferAttribute(points,3))
    geo.setIndex(triangles);geo.computeVertexNormals()
    const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.74}))
    group.add(mesh)
    return mesh
  }
  box(palette.ground,0,-.85,-world/2,170,1.3,world+70)
  const surface=ribbon(-11.5,11.5,0,palette.road)
  if(podium){
    box(palette.accent,0,.07,-world+3.2,17,.26,10)
    box(0xffeedb,0,.23,-world+3.4,15.8,.13,8.9)
    const deckMaterial=new T.MeshStandardMaterial({color:0xffead0,roughness:.52})
    matteSurface(deckMaterial,13,.11)
    const deckGrain=deckMaterial.onBeforeCompile
    deckMaterial.onBeforeCompile=(shader,renderer)=>{
      deckGrain(shader,renderer)
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec2 beam=(surfacePoint-vec2(.3,1.05))*vec2(.16,.44);
        totalEmissiveRadiance+=vec3(.15,.093,.053)*exp(-dot(beam,beam));
        // Soft reflections are confined to the tile immediately in front of each block.
        float reflectionDistance=(surfacePoint.y-1.96)*2.4;
        float bounce=exp(-reflectionDistance*reflectionDistance)*smoothstep(1.56,1.66,surfacePoint.y);
        float gold=exp(-pow(abs(surfacePoint.x)*.81,4.0));
        float silver=exp(-pow(abs(surfacePoint.x+3.7)*.81,4.0));
        float bronze=exp(-pow(abs(surfacePoint.x-3.7)*.81,4.0));
        totalEmissiveRadiance+=bounce*(vec3(.18,.111,.043)*gold+
          vec3(.112,.124,.148)*silver+vec3(.146,.083,.047)*bronze);
      `)
    }
    const deck=new T.Mesh(new T.PlaneGeometry(15.78,8.88).rotateX(-Math.PI/2),deckMaterial)
    deck.position.set(0,.297,-world+3.4);group.add(deck)
    box(0x605d6e,0,2.85,-world-.76,15.3,5.20,.45)
    const backdrop=paintedPanel(14.8,5.04,ctx=>{
      const {width,height}=ctx.canvas
      const tiles=['#fff8f0','#f4eff9','#e4eafa']
      for(let row=0;row<4;row++)for(let col=0;col<8;col++){
        const w=width/8,h=height/4
        ctx.fillStyle=tiles[(row+col)%tiles.length]
        ctx.fillRect(col*w,row*h,w+1,h+1)
        ctx.save();ctx.translate((col+.5)*w,(row+.5)*h)
        ctx.fillStyle='#625a86';ctx.font='800 18px sans-serif';ctx.textAlign='center'
        ctx.fillText((row+col)%2?'TRIATHLON':'SKT',0,4)
        ctx.fillStyle='#79769a';ctx.font='700 10px sans-serif';ctx.fillText('LUCKY DRAW',0,20)
        ctx.restore()
      }
    },art)
    backdrop.position.set(0,2.88,-world-.525);group.add(backdrop)
    box(0xdbbd96,0,5.48,-world-.40,15.1,.16,.20)
    box(0xcab294,0,.43,-world-.43,15.1,.15,.20)
    const stageAccent=courseColors[sport].accent
    for(const side of [-1,1]){
      const x=side*7.12
      box(0xe8c69d,x,.34,-world+4.4,.14,.085,5.4)
      box(stageAccent,x,.39,-world+4.4,.041,.028,5.1)
      for(const dz of [2.1,6.7]){
        box(0xd8b389,x,.388,-world+dz,.31,.15,.41)
        box(cream,x,.466,-world+dz,.23,.041,.33)
      }
    }
    for(const dx of [-7.42,-4.45,-1.48,1.48,4.45,7.42])
      box(0xf1dab4,dx,5.40,-world-.32,.24,.29,.25)
    for(const side of [-1,1]){
      box(0xd6b794,side*7.48,2.89,-world-.40,.17,5.19,.20)
      for(const y of [1.42,3.2,4.7])box(0xf2d9b6,side*7.48,y,-world-.32,.27,.20,.24)
    }
    for(const z of [1.0,2.2,3.4,4.6,5.8,7.0])
      box(0xdcc8b3,0,.299,-world+z,15.65,.008,.026)
    for(let row=0;row<7;row++)for(let joint=-2;joint<=2;joint++)
      box(0xdcc8b3,(joint+(row%2)*.5)*2.95,.299,-world+.4+row*1.2,.026,.008,1.17)
    for(const [x,z,turn,color] of [[-6.45,5.7,.34,0xe399b2],[-6.91,4.58,-.5,0xe9be67],
      [5.97,6.04,-.83,0xbd99cd],[6.64,5.67,.64,0xe3a1ad],[7.09,4.81,-.28,0xe9bd69]])
      box(color,x,.305,-world+z,.20,.014,.10,0,turn)
    for(const side of [-1,1]){
      const x=side*8.75
      box(cream,x,2.5,-world+.24,.35,4.9,.45)
      ball(0xffdf9b,x,5,-world+.22,.69,.69,.69)
      box(0xe0bd9a,side*7.29,.37,-world+.02,.79,.30,.48)
      box(0xd7b294,side*8.02,.39,-world+2.42,1.28,.38,2.21)
      shade(side*7.7,.304,-world+2.24,2.12,2.48,.28)
      for(let i=0;i<5;i++)ball(i%2?0x71bb91:0xa6ca7c,side*(7.99+i%2*.31),.62+i%3*.10,-world+1.73+i*.32,.88,.72,.83)
      for(let i=0;i<5;i++)ball(i%2?0xf6e4b3:0xf4c37d,side*(7.66+i%2*.27),.86+i%3*.10,-world+1.79+i*.31,.23,.17,.22)
      ball(0xe2b36a,side*6.52,.37,-world+2.24,.48,.21,.37)
    }
    const strings:number[]=[]
    const balloons=new T.InstancedMesh(new T.SphereGeometry(.5,20,14),
      new T.MeshStandardMaterial({roughness:.31}),18)
    const balloonPose=new T.Object3D(),balloonColor=new T.Color()
    for(let i=0;i<18;i++){
      const side=i%2?1:-1,x=side*(6+(i%3)*.59),y=.7+(i%5)*.58,z=-world+1+(i%4)*.5
      balloonPose.position.set(x,y,z)
      balloonPose.scale.set(.74+(i%3)*.055,.88+(i%4)*.06,.77)
      balloonPose.rotation.z=side*(i%4-1.5)*.08
      balloonPose.updateMatrix();balloons.setMatrixAt(i,balloonPose.matrix)
      balloons.setColorAt(i,balloonColor.setHex([0xf992b8,0x8cdcc6,0xffcd75,0xc5a5eb][Math.floor(i/2)%4]))
      strings.push(x,y-.44,z,side*6.52,.43,-world+2.24)
    }
    group.add(balloons)
    group.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(strings,3)),
      new T.LineBasicMaterial({color:0xdebb8d})))
  }else{
    for(const side of [-1,1]){
      ribbon(side*11.52,side*12.03,.14,sport==='cycling'?0xc7bbb1:0xfff3dc)
      const apron=ribbon(side*12.02,side*(sport==='cycling'?16.6:13.8),.06,sport==='swimming'?0xf9e9ce:sport==='cycling'?0xd5bdab:0xc0eed0)
      if(sport==='cycling')matteSurface(apron.material,8,.18)
    }
    if(sport==='swimming'){
      finishPool(at,box,ball,shade)
      floorNumbers(group,[1,2,3,4,5,6,7],[-9,9],.683,2.65,3,.76)
      for(const side of [-1,1]){
        box(0x478d9a,side*11.78,-.11,-world/2,.56,.55,world+16)
        ribbon(side*11.493,side*11.60,.019,0x83c8c5).material.roughness=.32
        ribbon(side*11.49,side*11.60,.126,0x386e80)
        ribbon(side*11.54,side*12.08,.195,0xffebce).material.roughness=.53
        ribbon(side*12.06,side*13.87,.081,0xc2b4a0).material.roughness=.38
        ribbon(side*12.12,side*12.30,.086,0xb4a48f)
        const dryDeck=ribbon(side*13.87,side*17.15,.073,0xf1d5a7)
        matteSurface(dryDeck.material,14,.22)
        matteSurface(ribbon(side*17.14,side*37,.037,0xf0dab1).material,12,.17)
        for(let tile=0;tile<Math.ceil((world+10)/1.01);tile++){
          const z=5-tile*1.01
          const color=tile%7===0?0xa2d3cf:tile%2?0x62acb4:0x74b8bf
          box(color,side*11.486,.075,z,.045,.096,.972)
        }
        for(let joint=0;joint<Math.ceil((world+8)/2.06);joint++){
          const z=4-joint*2.06
          box(0xd8bd9c,side*11.81,.200,z,.51,.011,.022)
          box(0xbdab96,side*15.48,.079,z,3.12,.009,.032)
          box(0xd9bea0,side*26.65,.043,z,18.98,.009,.024)
        }
        const drains=Math.ceil(world/4.2)
        for(let i=0;i<=drains;i++){
          const p=at(i/drains,side*12.22)
          box(0x998e82,p.x,.075,p.z,.16,.025,1.65)
          for(let bar=0;bar<6;bar++)box(0xebdbc4,p.x,.092,p.z+(bar-2.5)*.23,.17,.023,.065)
        }
        for(const u of [.105,.40,.73,.94]){
          const p=at(u,side*11.73)
          for(const dz of [-.42,.42]){
            box(0xb5dada,p.x,.38,p.z+dz,.085,1.45,.086)
            box(0xb5dada,p.x+side*.36,.96,p.z+dz,.78,.081,.085)
            box(0xb5dada,p.x+side*.73,.58,p.z+dz,.085,.76,.086)
          }
          for(const y of [-.19,.06,.31])box(0xc4e5df,p.x,y,p.z,.19,.073,.88)
        }
      }
      for(let x=-9;x<=9;x+=3){
        box(0xeaf5e7,x,.30,2.65,1.2,.58,.90)
        box(palette.accent,x,.62,2.65,1.29,.12,1)
        box(palette.accent,x,.28,-world-.53,1.32,.57,.18)
        box(cream,x,.32,-world-.42,1.14,.33,.06)
        for(const offset of [-.31,-.15,.01,.17,.33])
          box(0x93d5d4,x,.685,2.65+offset,1.02,.018,.036)
        for(const side of [-1,1]){
          box(0x87b9cb,x+side*.42,.32,2.33,.045,.50,.09)
          box(0x67aeb6,x+side*.45,.32,-world-.378,.062,.32,.04)
        }
      }
      for(let x=-15;x<=15;x+=3){
        box(0xc5d6c1,x,.58,10.5,.14,1.08,.15)
        box(cream,x,.25,10.52,.34,.34,.31)
        box(0xe0c8a1,x+1.53,.74,10.5,2.96,.08,.11)
        box(0xffe6ba,x+1.53,1.02,10.5,2.96,.11,.14)
        const color=[0x9bcadb,0xf1b576,0xd6a8c0][(x+15)/3%3]
        if(x===0||Math.abs(x)===6||Math.abs(x)===12){
          box(color,x,.1,8.6,4.3,.055,1.92)
          for(const dx of [-1.98,1.98])box(cream,x+dx,.135,8.6,.08,.015,1.71)
        }
        if(x%6===0){
          box(0xd2a984,x,.19,9.9,1.55,.37,.69)
          for(const dx of [-.46,0,.46])ball(0x6d9f78,x+dx,.42,9.9,.61,.50,.61)
        }
      }
      for(const [index,x] of [-13,-6.5,0,6.5,13].entries()){
        const z=14.4+index%2*.4
        box(0xe0c09b,x,.33,z,5.78,.54,1.84)
        box(0xf2d7ab,x,.61,z,5.96,.12,2.02)
        box(0x948369,x,.681,z,5.64,.035,1.72)
        shade(x,.066,z,6.09,2.21,.42)
        for(let plant=0;plant<9;plant++){
          const px=x+(plant-4)*.57,pz=z+(plant%2-.5)*.58
          ball(plant%3===0?0x5f9d78:0x85b67e,px,.82,pz,.83,.48,.82)
          ball([0xf3b9a4,0xffe2a3,0xd6c1e3][plant%3],px-.08,1.055,pz+.07,.33,.19,.28)
        }
      }
      for(const u of [.08,.90])pennants(u,22)
      for(let column=-9;column<=9;column+=3){
        ribbon(column-.06,column+.06,.011,0x4499bd)
        ribbon(column+1.466,column+1.534,.058,column===0?0xe2b96c:0x9bd4d6)
        const floats=Math.ceil(world/1.8)
        for(let i=0;i<=floats;i++){
          const {x,z}=at(i/floats,column+1.5)
          const accent=column===0?0xf3bf58:column<0?0x60b0bb:0x92bde8
          ball(i%5<2?0xfff4db:accent,x,.10,z,.18,.15,.32)
        }
      }
      for(const side of [-1,1])for(let i=0;i<12;i++){
        const {x,z}=at((i+.2)/11.7,side*(18+i%2*2.1))
        palm(x,z,1.05+i%3*.19,side*(i%2?.68:-.4))
        ball(0x65a578,x+side*1.2,.36,z+2.5,2.18,.84,1.47)
        ball(0xbf9b80,x+side*.63,.45,z-2.2,1.5,1.2,1.28,0,0,.27)
        if(i%2)continue
        const parasol=at(i/11.7,side*15.1)
        shade(parasol.x,.083,parasol.z,3.8,3.5,1.0)
        box(cream,parasol.x,1.12,parasol.z,.10,2.2,.10)
        for(let rib=0;rib<6;rib++){
          const a=rib*Math.PI/3
          ball(rib%2?0xffedbd:(i%4===0?0xf08b77:0xeeb054),parasol.x+.53*Math.cos(a),2.19,parasol.z+.53*Math.sin(a),1.48,.37,.68,0,-a,-.19)
        }
        for(const dz of [-.80,.80]){
          box(0xe9f5ea,parasol.x,.27,parasol.z+dz,1.65,.18,.59)
          box(0x52afba,parasol.x+side*.55,.46,parasol.z+dz,.67,.13,.59,0,0,side*.55)
        }
      }
      const {z:slideZ}=at(.391)
      for(const branch of [0,1]){
        const z=slideZ+branch*3.6
        const slide=new T.CatmullRomCurve3([
          new T.Vector3(-29,6.83,z-7),new T.Vector3(-36+branch*9,5.85,z-4),
          new T.Vector3(-32+branch*9,4.5,z+2),new T.Vector3(-26+branch*4,1.5,z+7),
          new T.Vector3(-24+branch*4,.48,z+11)
        ])
        const tube=new T.Mesh(new T.TubeGeometry(slide,28,.67,10,false),
          new T.MeshStandardMaterial({color:branch?0x349f9e:0xeb7c68,roughness:.36}))
        group.add(tube)
        for(const t of [.27,.56,.76]){
          const p=slide.getPoint(t)
          box(0xd9c5a3,p.x,p.y/2,p.z,.22,p.y,.25)
          const band=new T.Mesh(new T.TorusGeometry(.68,.092,6,12),
            new T.MeshStandardMaterial({color:0xf8cb59,roughness:.63}))
          band.position.copy(p)
          band.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),slide.getTangent(t));group.add(band)
        }
        for(let i=0;i<7;i++)ball(i%2?0x88a98b:0xb5987f,-27-i*.8,.3+i%3*.42,z+5+i*.6,2.4,1.1+i%3*.76,2.12)
      }
      box(0xccae9c,-29,.03,slideZ-5.2,8.9,.49,10.7)
      shade(-29,.279,slideZ-5.2,8.5,9.4,1.4)
      shade(-29,-.189,slideZ-5.2,11.3,13.9,2.0)
      box(cream,-29,6.63,slideZ-5.2,3.9,.38,6.7)
      box(0xd96560,-29,8.31,slideZ-5.2,4.8,.42,7.2)
      box(0xe88a6a,-29,8.60,slideZ-5.2,4.25,.24,6.8)
      for(const x of [-30.55,-27.45])for(const dz of [-8.1,-2.4]){
        box(0x558483,x,4.14,slideZ+dz,.33,8.28,.33)
        box(0xf5d4a4,x,.38,slideZ+dz,.64,.22,.65)
      }
      for(let flight=0;flight<3;flight++){
        const deckY=.31+2.11*flight
        const direction=flight%2?1:-1
        const center=slideZ-5.2
        const x=-29.6+flight*.53
        box(0x557884,x,deckY+1.01,center,.72,.24,5.2,Math.atan2(2.11*direction,4.7))
        for(let stair=0;stair<10;stair++){
          const z=center+direction*(2.35-stair*.47)
          box(0xe0ba91,x,deckY+stair*.211,z,.85,.103,.45)
        }
        box(cream,x,deckY+2.11,center-direction*2.6,2.7,.20,.75)
        for(const side of [-1,1]){
          box(0xd1ded4,x+side*.46,deckY+1.79,center,.070,.071,5.18,Math.atan2(2.11*direction,4.7))
          for(let post=0;post<5;post++)
            box(0x759d95,x+side*.46,deckY+.37+post*.526,center+direction*(2.35-post*1.175),.063,.76,.073)
        }
      }
      for(const side of [-1,1])for(let rail=0;rail<6;rail++){
        const z=slideZ-7.93+rail*1.05
        box(0x83a59e,-29+side*1.76,7.23,z,.078,.88,.08)
        box(0xd7e4d6,-29+side*1.76,7.66,z,.095,.073,1.1)
      }
      for(const side of [-1,1])for(const u of [.21,.49,.79]){
        const p=at(u,side*16.14)
        box(0xffe5bb,p.x,.18,p.z,3.2,.30,4.4)
        for(const dz of [-1.8,1.8])box(0xc09c7e,p.x,.83,p.z+dz,.17,1.48,.17)
        box(0xc09c7e,p.x,1.42,p.z,.15,.14,3.6)
        const ring=new T.Mesh(new T.TorusGeometry(.34,.088,8,16),new T.MeshStandardMaterial({color:0xe97969,roughness:.39}))
        ring.rotation.y=Math.PI/2
        ring.position.set(p.x-side*.12,1.17,p.z-.75);group.add(ring)
        for(let offset=0;offset<4;offset++)ball(offset%2?0x5e9d81:0x6aab83,p.x+side*(1.15+offset*.34),.30,p.z+(offset-1.5)*.81,1.30,.80,1.46)
      }
    }else if(sport==='cycling'){
      matteSurface(surface.material,14,.34)
      surface.material.roughness=.89
      const streetSections=Math.round(world/2.36)
      shopSigns(group,at,streetSections)
      const shopShells:number[][]=[]
      for(const side of [-1,1]){
        ribbon(side*.16-.055,side*.16+.055,.018,0xf7c64a)
        ribbon(side*11.14-.06,side*11.14+.06,.018,0xf6f5ea)
        for(let z=0;z<world*1.24;z+=2.36){
          const u=z/world, p=at(u,side*14.2),q=at(u+.01,side*14.2)
          box(0x9d908d,p.x,p.y+.066,p.z,4.05,.013,.034,0,-Math.atan2(q.x-p.x,p.z-q.z))
        }
      }
      for(let i=0;i<streetSections;i++){
        const u=i/streetSections
        for(const side of [-1,1]){
          const lane=at(u,side*5.55)
          const tangent=at(u+.003,side*5.55)
          box(0xf5f5ee,lane.x,lane.y+.023,lane.z,.11,.018,1.25,
            Math.atan2(tangent.y-lane.y,tangent.z-lane.z),-Math.atan2(tangent.x-lane.x,lane.z-tangent.z))
          if(i%5===0){
            const edge=at(u,side*13.25)
            box(0x525c66,edge.x,edge.y+2.18,edge.z,.11,4.4,.11)
            box(0x525c66,edge.x-side*.53,edge.y+4.34,edge.z,1.08,.10,.10)
            box(0xffefd5,edge.x-side*1.03,edge.y+4.28,edge.z,.47,.10,.29)
            for(const dz of [-.31,.31])box(0x323b44,edge.x+side*.58,edge.y+.54,edge.z+dz,.11,1.09,.11)
          }
          const curb=at(u,side*12.15)
          box(0x928886,curb.x,curb.y+.10,curb.z,.80,.046,.085)
          if(i%3===0){
            box(0x58636d,curb.x,curb.y+.25,curb.z,.29,.32,.29)
            box(0xe3bb6c,curb.x,curb.y+.425,curb.z,.27,.07,.27)
          }
          if(i%6===1){
            box(0x515666,curb.x,curb.y+.102,curb.z,.46,.065,1.08)
            for(let slot=0;slot<6;slot++)box(0x9d9d9f,curb.x,curb.y+.140,curb.z+(slot-2.5)*.16,.36,.022,.038)
          }
          if(i%3!==0)continue
          const shop=at(u,side*22)
          const section=u<.32?0:u<.72?1:2
          const h=3.7+section*1.02+i%7*.66,front=shop.x-side*5.04
          const frontage=i%2===0?6.4:5.5
          const facade=[
            [0xe3a5aa,0xefbc90,0xc5b3dc,0xd9cbab],
            [0xa1ceb9,0xf1c580,0x9bbfdb,0xe7ac9e],
            [0x9ec9d9,0xeac69a,0xc5b0dc,0xb4d1bd]
          ][section][(i/3+(side===1?2:0))%4]
          shopShells.push([facade,shop.x,(shop.y+h)/2-.22,shop.z,10,shop.y+h+.42,frontage])
          box(0xe0d0be,shop.x,shop.y+h,shop.z,10.26,.27,frontage+.29)
          box(0x6c7981,shop.x+side*2,shop.y+h+.40,shop.z+.7,1.8,.70,1.13)
          finishShop(box,ball,side,shop.x,shop.y,shop.z,front,h,frontage,i/3)
          // A dark recess, inner shelf and tinted glazing give the facade depth in the chase camera.
          box(0x495060,front,shop.y+1.06,shop.z,.12,1.87,frontage-.27)
          box(0x55576b,front-side*.12,shop.y+1.84,shop.z,.22,.31,frontage-.22)
          box(0x908783,front-side*.18,shop.y+.18,shop.z,.36,.21,frontage-.25)
          if(section===0&&i%6===3){
            for(let slat=0;slat<9;slat++)box(slat%2?0x9a8a91:0xb5a5aa,front-side*.09,shop.y+.24+slat*.17,shop.z+.89,.09,.15,2.69)
          }
          for(let floor=0;floor<Math.floor((h-2.4)/1.21);floor++){
            const y=shop.y+3.06+floor*1.21
            for(const dz of [-2.13,0,2.13]){
              box([0x4a688a,0x4a7684,0x5a6b8e][section],front-side*.07,y,shop.z+dz,.12,.82,1.52)
              box(0xacc7d2,front-side*.15,y+.30,shop.z+dz,.05,.07,1.50)
            }
          }
          const awning=[0xc27389,0x379c91,0x588cc0,0xd09259][(i/3+section)%4]
          for(let strip=0;strip<9;strip++)box(strip%2?0xffedcc:awning,
            front-side*.43,shop.y+1.96,shop.z+(strip-4)*.60,.98,.105,.60,0,0,side*.18)
          box(0x777c84,front-side*.11,shop.y+h*.49,shop.z+frontage*.43,.11,h*.89,.12)
          const sill=at(u,side*16.15)
          shade(sill.x,sill.y+.078,sill.z,3.65,6.65,.44)
          shade(front-side*.48,shop.y+.080,shop.z,3.05,frontage,.92)
          for(let prop=0;prop<3;prop++){
            const dz=-2+prop*.63
            box(section===0?0xd9ba90:0x52867e,sill.x,sill.y+.32+prop%2*.13,sill.z+dz,.58,.51+prop%2*.26,.50)
            box(0xf3e2bf,sill.x,sill.y+.57+prop%2*.26,sill.z+dz,.59,.06,.51)
          }
          if(i%6===0&&section===1){
            box(0x6f8695,sill.x,sill.y+.23,sill.z+1.55,.91,.13,.82)
            box(0x6f8695,sill.x+side*.37,sill.y+.69,sill.z+1.55,.075,1.02,.76)
            for(const dz of [1.28,1.83])ball(0x47505e,sill.x+side*.27,sill.y+.16,sill.z+dz,.24,.31,.16)
          }
          for(const dz of [-1.80,0,1.80]){
            if(section===0&&i%6===3&&dz>=0)continue
            const z=shop.z+dz
            const warm=section!==2&&(i/3+(dz===0?1:0))%3===0
            box(0x797d82,front-side*.125,shop.y+1.12,z,.095,1.55,1.34)
            box(warm?0x8f7e67:[0x68858e,0x526b78,0x708e9b][section],front-side*.184,shop.y+1.15,z,.033,1.34,1.13)
            box(warm?0xe0b77f:0x89aeaf,front-side*.207,shop.y+1.03,z,.019,.40,1.01)
            box(0xafc3ba,front-side*.215,shop.y+1.51,z-.15,.012,.105,.68,-.22)
            box(0x465961,front-side*.23,shop.y+.90,z,.072,.11,1.21)
            for(const spare of [-.32,.21])box(section===0?0xcdac8a:0x7fa299,
              front-side*.221,shop.y+.82,z+spare,.036,.18,.22)
            box(0xc1ab89,front-side*.24,shop.y+.25,z,.27,.15,1.41)
          }
          if(i%6===0){
            const tower=at(u,side*33)
            const height=14+i%4*4
            box([0xb8cadf,0xc1b9d8,0xb3d0d3][Math.floor(i/6)%3],tower.x,height/2,tower.z,9,height,10)
            for(let floor=2;floor<height-1;floor+=1.7){
              box(0x6b869d,tower.x-side*4.52,floor,tower.z,.13,.86,8.6)
              for(const dz of [-2.18,0,2.18])box(0x9faeb8,tower.x-side*4.61,floor,tower.z+dz,.05,.86,.08)
            }
          }
        }
      }
      const facadeGeometry=new RoundedBoxGeometry(1,1,1,1,.014)
      const facadePaint=new T.MeshStandardMaterial({roughness:.83})
      facadePaint.onBeforeCompile=shader=>{
        shader.vertexShader='varying vec3 facadePoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nfacadePoint=position;')
        shader.fragmentShader='varying vec3 facadePoint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float level=smoothstep(-.42,.35,facadePoint.y);
          float corner=smoothstep(.29,.50,abs(facadePoint.z));
          diffuseColor.rgb*=.88+level*.145-corner*.042;
        `)
      }
      const facades=new T.InstancedMesh(facadeGeometry,facadePaint,shopShells.length)
      const facadePose=new T.Object3D(), facadeColor=new T.Color()
      shopShells.forEach(([color,x,y,z,w,h,d],i)=>{
        facadePose.position.set(x,y,z);facadePose.scale.set(w,h,d);facadePose.updateMatrix()
        facades.setMatrixAt(i,facadePose.matrix);facades.setColorAt(i,facadeColor.setHex(color))
      })
      group.add(facades)
      for(const u of [.16,.81]){
        const {x,y,z}=at(u)
        for(let i=-9;i<=9;i++)ribbonMark(u,i*1.16)
        function ribbonMark(progress:number,lane:number){
          const p=at(progress,lane),q=at(progress+.01,lane)
          box(0xf4f3e8,p.x,p.y+.051,p.z,.69,.022,2.65,Math.atan2(q.y-p.y,p.z-q.z),-Math.atan2(q.x-p.x,p.z-q.z))
        }
        for(const side of [-1,1]){
          box(0xf4f3e8,x+side*5.75,y+.055,z+side*2.18,10.76,.024,.20)
          const ramp=at(u,side*12.38)
          box(0xd8aa63,ramp.x,ramp.y+.118,ramp.z,.76,.048,2.10)
          for(let row=0;row<6;row++)for(const offset of [-.21,0,.21])
            ball(0xf0c477,ramp.x+offset,ramp.y+.15,ramp.z+(row-2.5)*.31,.097,.031,.097)
          box(0x465262,x+side*12.5,y+2.19,z+side*2,.13,4.38,.13)
          box(0x42454d,x+side*12.49,y+4.35,z+side*2,.49,.39,1.0)
          for(const [slot,color] of [0x6b3936,0x826526,0x61d796].entries())
            ball(color,x+side*12.49,y+4.35,z+side*2+(slot-1)*.28,.19,.22,.22)
        }
      }
      for(const side of [-1,1])for(const u of [.89,.955]){
        const p=at(u,side*15.2)
        box(0xd8c7b2,p.x,p.y+.115,p.z,2.54,.12,4.42)
        box(0xa99e94,p.x,p.y+.32,p.z,1.56,.39,2.60)
        for(const dz of [-.68,0,.68])ball(0x729b89,p.x,p.y+.69,p.z+dz,1.27,.91,1.23)
      }
    }else{
      runningTrackSurface(surface)
      floorNumbers(group,[1,2,3,4,5,6,7,8],[-10.25,10.25],.045,2.31,2.93,1.6)
      stadiumCanopy(group,at,-1,box)
      finishStands(at,box,ball)
      for(let i=0;i<6;i++){
        const p=at((i+.33)/6,-22.40)
        const sign=paintedPanel(1.04,.51,ctx=>{
          ctx.fillStyle='#526976';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height)
          panelLettering(ctx,'A'+(i+1),'#f9e9c9',ctx.canvas.height*.70,ctx.canvas.height*.53)
        })
        sign.position.set(p.x,4.09,p.z);sign.rotation.y=Math.PI/2;group.add(sign)
      }
      for(const side of [-1,1]){
        ribbon(side*12.03,side*15.5,.058,0x9bd3a4)
        for(const u of [.085,.36,.66,.92]){
          const p=at(u,side*14.48)
          box(0xe0c792,p.x,.16,p.z,.88,.16,3.4)
          for(const dz of [-1.1,1.1])box(0xa99179,p.x,.235,p.z+dz,.73,.36,.17)
          box(0xf2dca2,p.x,.46,p.z,.98,.14,2.9)
        }
      }
      for(const z of [4,9,14]){
        for(const side of [-1,1]){
          box(palette.accent,side*12.8,2.9,z,.7,5.8,.85)
          box(cream,side*12.8,2.2,z,.76,.24,.91)
          box(0x9a526b,side*12.8,.21,z,1.23,.40,1.32)
          box(cream,side*12.8,.43,z,1.08,.095,1.10)
          box(0xb96077,side*12.8,.74,z,.92,.57,1.02)
        }
        box(palette.accent,0,5.86,z,26.2,.58,.83)
        for(const side of [-1,1])box(cream,side*12.37,5.82,z,.25,.61,.89)
      }
      for(const u of [.16,.54,.87])pennants(u,24,u===.54?.85:.25)
      for(let lane=-9;lane<=9;lane+=3)ribbon(lane-.037,lane+.037,.016,palette.line)
      for(const u of [.037,.051,.953])for(const side of [-1,1]){
        const p=at(u,side*10.71)
        for(const dz of [-.37,0,.37])
          box(cream,p.x,.024,p.z+dz,.52,.025,.081,0,-side*.21)
      }
      const standSections=Math.round(world/6.55)
      for(const side of [-1,1]){
        for(let i=0;i<standSections;i++){
          const u=(i+.5)/standSections
          for(let row=0;row<6;row++){
            const p=at(u,side*(16.15+row*1.12))
            const top=.43+row*.48
            const covered=side===-1||i%6<3
            box(covered?0xc5cbd1:0xecdccb,p.x,top/2,p.z,1.23,top,6.25)
            box(covered?0xc9c7c1:0xe5ddcd,p.x-side*.57,top-.09,p.z,.085,.095,6.24)
            for(let seat=0;seat<8;seat++){
              const z=p.z+(seat-3.5)*.68
              if(i%4===1&&seat<2){
                box(covered?0xd5cdbf:0xf0e7d4,p.x,top+.06,z,.99,.13,.69)
                continue
              }
              const color=(covered?[0x5285a3,0x4e9a89,0x729e8d]:[0x76aabf,0x77b7a2,0x98c09f])[Math.floor(i/3)%3]
              box(color,p.x,top+.095,z,.56,.16,.53)
              box(color,p.x+side*.26,top+.235,z,.13,.43,.49,0,0,-side*.095)
              if((seat*7+i*11+row*3)%13<(covered?7:5)){
                ball([0xffcc9d,0xf7a4b7,0xa7a5db,0x72b7c4][(i+seat+row)%4],p.x,top+.40,z,.37,.51,.37)
                ball(0xf0c7a0,p.x-side*.04,top+.69,z,.25,.25,.25)
              }
            }
          }
          const roof=at(u,side*20)
          if(side===-1){
            const back=at(u,side*23.3)
            box(0x87a4a6,back.x,3.65,back.z,.33,1.52,6.38)
            box(0x596e79,back.x-side*.19,4.34,back.z,.15,.16,6.39)
            for(const dz of [-2.17,0,2.17])box(0x9aabad,back.x-side*.21,3.87,back.z+dz,.11,.88,1.55)
          }
          if(side===1&&i%6<3){
            box(0xe8d8c4,roof.x,5.13,roof.z,8.9,.22,6.45)
            box(0x6b8b94,roof.x+side*3.92,2.54,roof.z,.22,5.1,.24)
          }
          const rail=at(u,side*15.18)
          shade(rail.x,.065,rail.z,1.52,7.3,.38)
          box(0xe8e1cd,rail.x,1.12,rail.z,.09,.09,6.4)
          for(const dz of [-2.8,0,2.8])box(0xe8e1cd,rail.x,.57,rail.z+dz,.096,1.12,.096)
        }
        const ad=paintedPanel(9.3,1.38,ctx=>{
          ctx.fillStyle=side===1?'#bf375c':'#3a4169';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height)
          panelLettering(ctx,side===1?'SKT TRIATHLON':'LUCKY DRAW','#fff3df',76,ctx.canvas.height/2)
        },art)
        for(const u of [.08,.20,.32,.45,.57,.69,.81,.93]){
          const p=at(u,side*13.44)
          box(0x323955,p.x,.70,p.z,.20,1.45,9.44)
          for(const dz of [-3.76,3.76])box(0x5c6a77,p.x+side*.13,.18,p.z+dz,.51,.21,.34)
          const board=ad.clone()
          board.position.set(p.x-side*.11,.72,p.z)
          board.rotation.y=-side*Math.PI/2
          group.add(board)
          box(0x667783,p.x+side*.12,.12,p.z,.16,.09,8.55)
          for(const dz of [-4.58,4.58]){
            box(0xc2c4aa,p.x-side*.13,.72,p.z+dz,.071,1.46,.16)
            box(0x506477,p.x+side*.08,.07,p.z+dz,.65,.11,.38)
          }
        }
        for(const u of [.20,.64,.94]){
          const p=at(u,side*26)
          tree(p.x,p.z,1.45)
          for(const dz of [-2,2])box(0x737a91,p.x,5.5,p.z+dz,.17,11,.17)
          box(0xe8eef8,p.x,10.36,p.z,.39,1.5,4.74)
        }
      }
      for(const u of [.35,.73]){
        const p=at(u,-14.8)
        shade(p.x,.065,p.z,2.4,9.96,.39)
        box(0x1b2743,p.x,4.35,p.z,.42,2.90,9.28)
        for(const y of [2.94,5.78])box(0xbbcbd0,p.x+.22,y,p.z,.14,.11,9.29)
        for(const dz of [-4.55,4.55])box(0xd9c4a1,p.x+.24,4.35,p.z+dz,.08,2.89,.15)
        for(const dz of [-3.56,3.56]){
          box(0x555f71,p.x,1.46,p.z+dz,.33,2.93,.35)
          box(0x7d8e95,p.x,.17,p.z+dz,.81,.29,.76)
          box(0x66798c,p.x-.16,2.62,p.z+dz,.29,.65,.18,0,0,.52)
        }
        const board=paintedPanel(8.99,2.62,ctx=>{
          const {width,height}=ctx.canvas
          ctx.fillStyle='#172944';ctx.fillRect(0,0,width,height)
          ctx.fillStyle='#2da3b4';ctx.fillRect(0,0,width,24)
          panelLettering(ctx,'SKT TRIATHLON','#d4f7fa',86,height*.34)
          panelLettering(ctx,'TRACK & FIELD','#f9d88f',64,height*.65)
        })
        board.position.set(p.x+.22,4.35,p.z);board.rotation.y=Math.PI/2;group.add(board)
        if(u===.73){
          regularBoard=board
          sprintBoard=paintedPanel(8.99,2.62,ctx=>{
            const {width,height}=ctx.canvas
            ctx.fillStyle='#51245c';ctx.fillRect(0,0,width,height)
            ctx.fillStyle='#ffc472';ctx.fillRect(0,0,width,24)
            panelLettering(ctx,'마지막 스퍼트','#fff1b5',104,height*.39)
            panelLettering(ctx,'FINAL SPRINT','#fbc085',52,height*.71)
          })
          sprintBoard.position.copy(board.position);sprintBoard.rotation.copy(board.rotation)
          sprintBoard.visible=false;group.add(sprintBoard)
        }
      }
    }
    for(const u of [0,1]){
      const {x,y,z}=at(u)
      if(u===1)for(let i=0;i<22;i++)for(let row=0;row<2;row++)
        box((i+row)%2?0xfff8df:0x3d3859,x-10.5+i,y+.025,z+row*.68,1,.04,.68)
      const arch=u===1?7.3:5.28
      const post=u===1?13:11.6
      for(const side of [-1,1]){
        const h=u===1?arch:2.3
        const anchor=x+side*post
        box(palette.accent,anchor,y+h/2,z,.75,h,.65)
        box(cream,anchor,y+h-.22,z,.82,.22,.71)
        box(0x576573,anchor,y+.10,z,1.25,.20,1.12)
        box(palette.accent,anchor,y+.49,z,.99,.78,.90)
        box(cream,anchor,y+.87,z,1.01,.08,.92)
        for(const dz of [-.44,.44])box(0xddccb2,anchor+side*.48,y+.21,z+dz,.13,.043,.13)
        if(u===1){
          box(0x4b5264,anchor-side*.47,y+1.49,z,.26,.36,.30)
          box(0x99dcd4,anchor-side*.611,y+1.51,z,.03,.11,.13)
        }
      }
      for(let lane=-9;lane<=9;lane+=3){
        for(const offset of [-.65,.65])
          box(sport==='swimming'?0x7fc4c8:cream,x+lane+offset,y+.022,z+(u===1?-.83:1.46),.08,.035,.53)
      }
      if(u===1){
        box(palette.accent,x,y+arch,z,post*2+.8,.56,.65)
        const bands=sport==='running'?[0xffda90,0x86c8bb]:sport==='swimming'?[0x8ed6d5,0xddf2e4]:[0xd3b3e3,0xf5ce99]
        for(const side of [-1,1]){
          const anchor=x+side*post
          box(palette.accent,anchor,y+arch-.17,z,1.29,.96,.92)
          box(bands[0],anchor,y+1.12,z,1.01,.22,.91)
          box(bands[1],anchor,y+1.33,z,.95,.16,.88)
          for(const [i,color] of bands.entries()){
            box(color,anchor-side*(2.0+i*.56),y+arch,z,.54,.60,.69)
          }
          for(const dz of [-2.6,2.6]){
            box(0x738594,anchor,y+.12,z+dz,.69,.22,.73)
            box(bands[0],anchor,y+.41,z+dz,.55,.37,.52)
          }
        }
        box(0xe4d5bf,x,y+arch+.08,z-.339,6.36,.98,.075)
        const sign=paintedPanel(6.1,.81,ctx=>{
          ctx.fillStyle='#302641';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height)
          panelLettering(ctx,'FINISH','#fff0d1',102,ctx.canvas.height/2)
        })
        sign.position.set(x,y+arch+.08,z-.382)
        sign.rotation.y=Math.PI;group.add(sign)
      }
    }
    raceBeats[sport].forEach(({gate},i)=>{

      const {x,y,z}=at(gate)
      if(i===1&&sport!=='swimming')for(const side of [-1,1])ball(0xffc463,x+side*12,y+.85,z,.75,.9,.75)
    })
  }
  if(podium)addCourseProps(group,'podium',(u,lane=0)=>({x:lane,y:0,z:-world*u}),shade,sport)
  else addCourseProps(group,sport,at,shade)
  const dummy=new T.Object3D()
  if(shadows.length){
    const contact=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),
      new T.MeshBasicMaterial({map:contactTexture(),transparent:true,depthWrite:false,toneMapped:false,opacity:.69}),shadows.length)
    shadows.forEach(([x,y,z,w,d,rx],i)=>{
      dummy.position.set(x,y,z);dummy.scale.set(w,1,d);dummy.rotation.x=rx;dummy.updateMatrix();contact.setMatrixAt(i,dummy.matrix)
    })
    group.add(contact)
  }
  const tint=new T.Color()
  for(const [items,round] of [[boxes,false],[balls,true]] as const){
    if(!items.length)continue
    const mesh=new T.InstancedMesh(round?new T.SphereGeometry(.5,12,8):new T.BoxGeometry(),
      new T.MeshStandardMaterial({roughness:.76}),items.length)
    items.forEach(([color,x,y,z,w,h,d,rx,ry,rz],i)=>{
      dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix()
      mesh.setMatrixAt(i,dummy.matrix)
      mesh.setColorAt(i,tint.setHex(color))
    })
    group.add(mesh)
  }
  const waterTime={value:0}
  if(sport==='swimming'&&!podium){
    surface.material.roughness=.42
    surface.material.onBeforeCompile=shader=>{
      shader.uniforms.waterTime=waterTime
      shader.uniforms.poolKeyDirection={value:keyDirection.clone().normalize()}
      shader.vertexShader='varying vec2 poolPoint;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\npoolPoint=position.xz;')
      shader.fragmentShader='uniform float waterTime; uniform vec3 poolKeyDirection; varying vec2 poolPoint;\n'+shader.fragmentShader.replace(
        '#include <color_fragment>',`#include <color_fragment>
        vec2 tilePoint=poolPoint*1.44+.026*vec2(sin(poolPoint.y*4.0+waterTime*.67),cos(poolPoint.x*5.0-waterTime*.7));
        vec2 grid=abs(fract(tilePoint)-.5);
        float grout=smoothstep(.458,.49,max(grid.x,grid.y));
        float tileShift=fract(sin(dot(floor(tilePoint),vec2(37.1,29.3)))*15731.7)-.5;
        vec2 flow=poolPoint+vec2(sin(poolPoint.y*1.4+waterTime)*.18,cos(poolPoint.x*1.7-waterTime)*.25);
        float a=sin(flow.x*3.9+flow.y*2.5+sin(flow.y*1.9+waterTime));
        float b=cos(flow.y*4.0-flow.x*1.5+sin(flow.x*2.1-waterTime*.93));
        float caustic=pow(1.0-abs(a*b),18.0);
        float swells=sin(flow.y*1.2+flow.x*.5+waterTime*1.25)*cos(flow.x*.69-waterTime*.82);
        float shallow=smoothstep(6.6,11.45,abs(poolPoint.x));
        float edgeDistance=(abs(poolPoint.x)-11.28)*7.0;
        float edge=exp(-edgeDistance*edgeDistance);
        float laneBands=1.0-smoothstep(.025,.066,abs(fract(poolPoint.x/3.0+.5)-.5));
        diffuseColor.rgb=mix(vec3(.012,.29,.49),vec3(.039,.48,.56),shallow*.78);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.66,.67),max(0.0,swells)*.20);
        diffuseColor.rgb*=1.0-laneBands*.16;
        diffuseColor.rgb*=1.0-grout*mix(.09,.29,shallow)+swells*.085+tileShift*.07;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.63,.94,1.0),caustic*mix(.27,.35,shallow)+edge*.14);
        `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec2 waterSlope=vec2(cos(flow.x*3.1+flow.y*2.2+waterTime*1.2),sin(flow.y*4.4-flow.x*1.3-waterTime*1.1))*.13;
          waterSlope+=vec2(sin(flow.x*8.4-flow.y*5.9-waterTime*2.8),cos(flow.y*7.4+flow.x*5.6+waterTime*2.4))*.072;
          float rippleLod=1.0-smoothstep(.08,.50,length(fwidth(poolPoint)));
          normal=normalize(normal+mat3(viewMatrix)*vec3(waterSlope.x,0.0,waterSlope.y)*rippleLod);
        `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          vec3 poolSun=mat3(viewMatrix)*poolKeyDirection;
          float angle=max(dot(normal,normalize(poolSun+normalize(vViewPosition))),0.0);
          float facets=pow(.5+.5*sin(flow.x*15.0-flow.y*13.0+sin(flow.y*11.0)+waterTime*2.4),6.0);
          float sparkle=pow(angle,100.0)*facets*rippleLod;
          totalEmissiveRadiance+=vec3(.64,.92,1.0)*(sparkle*.39+caustic*.040);
        `).replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
          material.specularColor*=.57;
        `)
    }
  }
  return (time:number,sprinting=false)=>{
    waterTime.value=time
    if(regularBoard&&sprintBoard){
      regularBoard.visible=!sprinting
      sprintBoard.visible=sprinting
    }
  }
}
