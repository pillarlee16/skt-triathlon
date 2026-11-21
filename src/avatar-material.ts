import * as T from 'three'
import type {AvatarStyle} from './avatar-style.ts'

type Surface='uniform'|'swimCap'|'helmet'|'headband'

const patterns:Record<Surface,string>={
  uniform:`
    float y=vAvatarLocal.y;
    if (vAvatarVariant<.5) return max(styleEdge(abs(vAvatarLocal.x),.25),styleEdge(y,.27));
    if (vAvatarVariant<1.5) return styleEdge(y,.04);
    if (vAvatarVariant<2.5) return 1.0-styleEdge(abs(y+.70*vAvatarLocal.x+.30*vAvatarLocal.z),.155);
    return 1.0-styleEdge(abs(abs(vAvatarLocal.x)-.13),.055);
  `,
  swimCap:`
    float x=abs(vAvatarLocal.x);
    if (vAvatarVariant<.5) return 0.0;
    if (vAvatarVariant<1.5) return 1.0-styleEdge(x,.15);
    if (vAvatarVariant<2.5) return 1.0-styleEdge(abs(x-.16),.052);
    return styleEdge(vAvatarLocal.x,.005);
  `,
  helmet:`
    float x=abs(vAvatarLocal.x);
    if (vAvatarVariant<.5) return 1.0-styleEdge(x,.146);
    if (vAvatarVariant<1.5) return 1.0-styleEdge(abs(x-.15),.049);
    if (vAvatarVariant<2.5) return styleEdge(x,.30);
    return styleEdge(vAvatarLocal.x,.008);
  `,
  headband:`
    if (vAvatarVariant<.5 || vAvatarVariant>1.5) return 1.0;
    return styleEdge(abs(vMapUv.y-.5),.144);
  `,
}

export function styledSurface(geometry:T.BufferGeometry,styles:AvatarStyle[],map:T.Texture,surface:Surface,roughness:number){
  const trim=new Float32Array(styles.length*3)
  const variants=new Float32Array(styles.length)
  const color=new T.Color()
  styles.forEach((style,i)=>{
    color.set(style.accent)
    trim.set([color.r,color.g,color.b],i*3)
    variants[i]=surface==='uniform'?style.pattern:style.gear
  })
  geometry.setAttribute('avatarTrim',new T.InstancedBufferAttribute(trim,3))
  geometry.setAttribute('avatarVariant',new T.InstancedBufferAttribute(variants,1))
  const material=new T.MeshStandardMaterial({map,roughness})
  material.customProgramCacheKey=()=>surface
  material.onBeforeCompile=shader=>{
    shader.vertexShader=`
      attribute vec3 avatarTrim;
      attribute float avatarVariant;
      varying vec3 vAvatarTrim;
      varying vec3 vAvatarLocal;
      varying float vAvatarVariant;
    `+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vAvatarTrim=avatarTrim;
      vAvatarLocal=position;
      vAvatarVariant=avatarVariant;
    `)
    shader.fragmentShader=`
      varying vec3 vAvatarTrim;
      varying vec3 vAvatarLocal;
      varying float vAvatarVariant;
      float styleEdge(float value,float line) {
        float softness=clamp(fwidth(value),.006,.035);
        return smoothstep(line-softness,line+softness,value);
      }
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float trimMask=avatarStyleMask();
      vec3 uniformDetail=texture2D(map,vMapUv).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,vAvatarTrim*uniformDetail,trimMask);
    `).replace('void main() {',`float avatarStyleMask(){${patterns[surface]} }\nvoid main() {`)
  }
  return material
}
