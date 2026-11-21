import * as T from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {costumeFamilies,type AvatarStyle,type Costume} from './avatar-style.ts'
import type {Sport} from './model.ts'

type Paint='base'|'trim'|'linen'|'ink'|'copper'
type Mount='head'|'torso'
type Piece={shape:'box'|'orb'|'disc';paint:Paint;size:number[];at:number[];tilt?:number}
const box=(paint:Paint,w:number,h:number,d:number,x:number,y:number,z:number,tilt?:number):Piece=>
  ({shape:'box',paint,size:[w,h,d],at:[x,y,z],tilt})
const orb=(paint:Paint,w:number,h:number,d:number,x:number,y:number,z:number,tilt?:number):Piece=>
  ({shape:'orb',paint,size:[w,h,d],at:[x,y,z],tilt})
const disc=(paint:Paint,w:number,h:number,d:number,x:number,y:number,z:number,tilt?:number):Piece=>
  ({shape:'disc',paint,size:[w,h,d],at:[x,y,z],tilt})

const outfits:Record<Costume,{head:Piece[];torso:Piece[]}>={
  retro:{
    head:[box('trim',.66,.095,.29,0,.575,.263),box('linen',.49,.025,.022,0,.59,.413)],
    torso:[box('trim',.60,.25,.10,0,.13,.322,-.37),
      box('linen',.56,.024,.022,0,.15,.382,-.37),box('linen',.36,.024,.022,0,.055,.382,-.37)],
  },
  pit:{
    head:[box('ink',.32,.19,.50,0,.655,.18,-.10),
      box('trim',.14,.08,.40,0,.754,.202),box('linen',.037,.025,.29,0,.797,.215)],
    torso:[box('ink',.52,.37,.18,0,.09,.355),
      box('trim',.57,.083,.041,0,.19,.447),box('linen',.43,.034,.04,0,.10,.449)],
  },
  surf:{
    head:[orb('trim',.20,.25,.41,-.17,.66,.26,-.47),orb('linen',.12,.13,.36,-.09,.725,.32,-.47)],
    torso:[orb('trim',.25,.41,.19,-.30,.02,.29,-.22),orb('trim',.25,.41,.19,.30,.02,.29,.22),
      orb('linen',.27,.14,.095,.08,.115,.39,.24),orb('trim',.16,.10,.08,.18,.13,.431,.24)],
  },
  trail:{
    head:[box('trim',.44,.126,.28,.05,.585,.285,.10),box('ink',.15,.065,.04,.16,.59,.431,.10)],
    torso:[box('trim',.58,.39,.13,0,.09,.305),box('ink',.11,.32,.075,-.18,.07,.399,-.15),
      box('ink',.11,.32,.075,.18,.07,.399,.15),box('linen',.31,.09,.065,0,.12,.444),
      box('base',.21,.15,.099,0,-.044,.416)],
  },
  wind:{
    head:[box('trim',.48,.094,.38,.15,.59,.245,.32),box('trim',.32,.08,.22,.33,.537,.30,-.28)],
    torso:[orb('trim',.76,.16,.36,0,.31,.185),box('base',.49,.23,.105,0,.19,.35),
      box('linen',.028,.20,.045,0,.188,.415),box('ink',.075,.075,.04,0,.165,.437)],
  },
  quilt:{
    head:[orb('base',.61,.25,.38,0,.596,.243),box('trim',.44,.062,.19,0,.672,.33)],
    torso:[box('base',.62,.47,.19,0,.065,.342),box('trim',.56,.39,.06,0,.065,.449),
      ...[-.16,0,.16].map(x=>box('base',.032,.37,.039,x,.065,.484,-.29)),
      box('linen',.47,.035,.039,0,.063,.487,.16)],
  },
  pinwheel:{
    head:[box('ink',.087,.27,.087,0,.678,.365),
      box('trim',.44,.16,.14,-.106,.848,.37,.59),box('linen',.16,.43,.14,.113,.833,.387,.59),
      box('trim',.12,.34,.15,-.13,.80,.38,-.73),orb('copper',.156,.156,.12,0,.83,.452)],
    torso:[box('trim',.41,.41,.15,0,.095,.37,Math.PI/4),
      box('linen',.33,.077,.03,0,.111,.454,-Math.PI/4),orb('copper',.102,.102,.04,0,.095,.48)],
  },
  post:{
    head:[box('ink',.36,.16,.36,0,.648,.278),box('trim',.061,.33,.075,-.125,.781,.33,.25),
      box('trim',.061,.242,.075,.133,.74,.33,-.26),orb('linen',.13,.13,.11,-.17,.94,.34),
      orb('copper',.13,.13,.11,.17,.85,.34)],
    torso:[box('ink',.59,.41,.22,0,.081,.37),box('trim',.50,.34,.08,0,.075,.498),
      box('linen',.34,.15,.04,0,.09,.551),box('ink',.26,.035,.042,0,.104,.577),
      box('copper',.115,.054,.041,.132,-.035,.553)],
  },
  coral:{
    head:[orb('trim',.18,.44,.20,.19,.741,.29,-.28),orb('trim',.14,.31,.16,.033,.77,.31,.50),
      orb('copper',.136,.24,.15,.345,.78,.29,-.52),orb('linen',.09,.13,.12,.26,.934,.29,-.28)],
    torso:[orb('trim',.48,.43,.29,.08,.064,.37),orb('linen',.148,.142,.087,-.05,.12,.508),
      orb('copper',.116,.118,.07,.167,.03,.52),orb('base',.124,.115,.08,.14,.178,.49)],
  },
  acorn:{
    head:[orb('copper',.71,.36,.49,0,.691,.225),orb('ink',.17,.19,.155,.048,.903,.278,-.34),
      ...[-.22,-.11,0,.11,.22].map(x=>orb('linen',.039,.08,.13,x,.718,.443-Math.abs(x)*.32,-.21))],
    torso:[orb('trim',.49,.52,.20,-.018,.072,.354,-.46),
      box('linen',.034,.44,.037,-.018,.081,.461,-.46),box('base',.075,.166,.043,-.135,-.09,.441,-.46)],
  },
  cloud:{
    head:[orb('linen',.49,.22,.31,.03,.694,.31),orb('linen',.27,.32,.29,-.06,.738,.3),
      orb('trim',.19,.13,.21,.22,.669,.28)],
    torso:[orb('linen',.63,.30,.28,0,.13,.38),orb('linen',.34,.41,.26,-.11,.19,.36),
      orb('linen',.27,.26,.29,.20,.18,.36),box('trim',.13,.24,.10,.02,.005,.5,.43),
      box('copper',.095,.17,.085,-.055,-.094,.503,.50)],
  },
  hotteok:{
    head:[disc('ink',.69,.12,.61,0,.656,.206),disc('copper',.59,.12,.53,0,.726,.206),
      box('linen',.16,.092,.15,0,.794,.22)],
    torso:[orb('copper',.57,.52,.22,0,.033,.36),orb('linen',.46,.40,.14,0,.034,.472),
      ...[-.12,0,.12].map(x=>box('copper',.039,.265,.028,x,.031,.545,.37)),
      box('copper',.355,.036,.028,0,.04,.547,.37)],
  },
}

const weights:Record<Paint,number[]>={
  base:[1,0,0,0],trim:[0,1,0,0],linen:[0,0,1,0],ink:[0,0,0,0],copper:[0,0,0,1],
}

function geometryFor(pieces:Piece[],mount:Mount,sport:Sport){
  const attached=mount==='head'?[orb('base',.43,.23,.39,0,.545,.236),...pieces]:pieces
  const geometries=attached.map(piece=>{
    const [w,h,d]=piece.size
    const shape=piece.shape==='box'?new RoundedBoxGeometry(w,h,d,1,Math.min(.055,h*.34,d*.34)):
      piece.shape==='orb'?new T.SphereGeometry(.5,12,8).scale(w,h,d):
        new T.CylinderGeometry(.5,.5,1,16).scale(w,h,d)
    const geometry=shape.index?shape.toNonIndexed():shape
    if(geometry!==shape)shape.dispose()
    geometry.rotateZ(piece.tilt??0)
    const [x,y,z]=piece.at
    if(mount==='head'){
      const height=sport==='cycling'?.82:sport==='swimming'?.89:1
      geometry.translate(x,y-.58,z)
      geometry.scale(1,height,1)
      geometry.translate(0,sport==='cycling'?.70:.62,0)
    }else{
      geometry.translate(x,y,z)
      geometry.scale(1,1,sport==='cycling'?.88:1)
      if(sport==='cycling')geometry.translate(0,0,.068)
    }
    const count=geometry.getAttribute('position').count
    const paint=new Float32Array(count*4)
    for(let i=0;i<count;i++)paint.set(weights[piece.paint],i*4)
    geometry.setAttribute('costumePaint',new T.BufferAttribute(paint,4))
    return geometry
  })
  const merged=mergeGeometries(geometries)
  geometries.forEach(geometry=>geometry.dispose())
  return merged
}

function costumeMaterial(roughness:number){
  const material=new T.MeshStandardMaterial({roughness})
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec4 costumePaint; attribute vec3 costumeTrim; varying vec4 vCostumePaint; varying vec3 vCostumeTrim;\n'+
      shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCostumePaint=costumePaint; vCostumeTrim=costumeTrim;')
    shader.fragmentShader='varying vec4 vCostumePaint; varying vec3 vCostumeTrim;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec3 ink=vec3(.034,.047,.083);
        vec3 costumeColor=ink+vCostumePaint.x*(diffuseColor.rgb-ink)+vCostumePaint.y*(vCostumeTrim-ink)
          +vCostumePaint.z*(vec3(.89,.81,.62)-ink)+vCostumePaint.w*(vec3(.57,.24,.074)-ink);
        diffuseColor.rgb=costumeColor;
      `)
  }
  return material
}

export function buildCostumeBatches(group:T.Group,styles:AvatarStyle[],sport:Sport){
  const mounts=styles.map(()=>({} as Partial<Record<Mount,{mesh:T.InstancedMesh;index:number}>>))
  const meshes:T.InstancedMesh[]=[]
  if(!styles.some(style=>style.costume))return {mounts,meshes}
  const head=costumeMaterial(sport==='cycling'?.35:sport==='swimming'?.55:.72)
  const torso=costumeMaterial(sport==='swimming'?.55:.84)
  const tint=new T.Color()
  for(const costume of costumeFamilies.flat()){
    const members=styles.flatMap((style,index)=>style.costume===costume?[index]:[])
    if(!members.length)continue
    for(const mount of ['head','torso'] as const){
      const geometry=geometryFor(outfits[costume][mount],mount,sport)
      const accents=new Float32Array(members.length*3)
      const mesh=new T.InstancedMesh(geometry,mount==='head'?head:torso,members.length)
      members.forEach((player,index)=>{
        mounts[player][mount]={mesh,index}
        mesh.setColorAt(index,tint.set(styles[player].primary))
        tint.set(styles[player].accent).toArray(accents,index*3)
      })
      geometry.setAttribute('costumeTrim',new T.InstancedBufferAttribute(accents,3))
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage)
      mesh.frustumCulled=false
      group.add(mesh)
      meshes.push(mesh)
    }
  }
  return {mounts,meshes}
}
