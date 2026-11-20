import {labels,sports,type Person,type Prize,type Sport} from './model.ts'
export async function parseWorkbook(file:File) {
  if(!file.name.toLowerCase().endsWith('.xlsx') || file.size>4_000_000) throw new Error('4 MB 이하의 .xlsx 파일을 선택하세요.')
  const {readSheet}=await import('read-excel-file/browser')
  const [peopleRows,prizeRows]=await Promise.all([readSheet(file,'참가자'),readSheet(file,'상품')])
  return parseRows(peopleRows,prizeRows)
}
export function parseRows(peopleRows:unknown[][],prizeRows:unknown[][]) {
  const errors:string[]=[]
  const people:Person[]=[]
  const prizes={} as Record<Sport,Prize>
  const column=(rows:unknown[][],names:string[],sheet:string)=>{
    const indexes=names.map(name=>rows[0]?.indexOf(name)??-1)
    indexes.forEach((i,k)=>{if(i<0) errors.push(sheet+' 시트 열 누락 - '+names[k])})
    return (row:unknown[])=>indexes.map(i=>String(row[i]??'').trim())
  }
  const personColumns=column(peopleRows,['참가번호','이름','조직','사진 파일명','참가 여부'],'참가자')
  const colorIndex=peopleRows[0]?.indexOf('의상 색상')??-1
  const prizeColumns=column(prizeRows,['종목','상품명','이미지 파일명'],'상품')
  const seen=new Set<string>()
  peopleRows.slice(1).forEach((row,i)=>{
    const [id,name,team,photo,flag]=personColumns(row)
    const color=String(row[colorIndex]??'').trim()
    if(![id,name,team,photo,flag].some(Boolean)) return
    const line='참가자 '+(i+2)+'행'
    if(!id || !name) errors.push(line+' 참가번호와 이름을 입력하세요.')
    if(seen.has(id)) errors.push(line+' 중복 참가번호 '+id)
    if(!['참가','불참','TRUE','FALSE','1','0','Y','N'].includes(flag.toUpperCase())) errors.push(line+' 참가 또는 불참을 입력하세요.')
    if(color && !/^#[0-9a-f]{6}$/i.test(color)) errors.push(line+' 의상 색상은 #RRGGBB 형식으로 입력하세요.')
    seen.add(id)
    people.push({id,name,team,photo,active:['참가','TRUE','1','Y'].includes(flag.toUpperCase()),...(color?{color}:{})})
  })
  prizeRows.slice(1).forEach((row,i)=>{
    const [label,name,image]=prizeColumns(row)
    if(!label && !name && !image) return
    const sport=sports.find(k=>labels[k]===label || k===label.toLowerCase())
    const line='상품 '+(i+2)+'행'
    if(!sport || !name) {errors.push(line+' 종목과 상품명을 확인하세요.');return}
    if(prizes[sport]) errors.push(line+' 종목이 중복됩니다.')
    prizes[sport]={name,image}
  })
  if(people.filter(p=>p.active).length<9) errors.push('참가 상태인 인원이 9명 이상이어야 합니다.')
  sports.forEach(k=>{if(!prizes[k]) errors.push(labels[k]+' 상품이 누락되었습니다.')})
  return {people,prizes,errors}
}
