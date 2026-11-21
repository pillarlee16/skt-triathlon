import assert from 'node:assert/strict'
import {test} from 'node:test'
import {assignAvatarStyles,costumeFamilies,starterStyle} from '../src/avatar-style.ts'
import {fixture} from './fixture.ts'

test('90 avatars are balanced, unique and independent of roster order or names',()=>{
  const people=fixture().people
  const styles=assignAvatarStyles(people)
  const counts=Array<number>(12).fill(0)
  for(const style of styles.values())counts[style.palette]++
  assert.equal(styles.size,90)
  assert.equal(Math.max(...counts)-Math.min(...counts),1)
  assert.equal(new Set([...styles.values()].map(({palette,pattern,gear})=>[palette,pattern,gear].join('/'))).size,90)
  for(const key of ['pattern','gear'] as const)assert.equal(new Set([...styles.values()].map(v=>v[key])).size,4)
  assert.deepEqual(assignAvatarStyles(people.slice().reverse().map(p=>({...p,name:'동명이인'}))),styles)
  assert.deepEqual(assignAvatarStyles(JSON.parse(JSON.stringify(people))),styles)
})

test('90 costumes have a 60/30 split with five colorways per festival design',()=>{
  const styles=[...assignAvatarStyles(fixture().people).values()]
  for(const [sportswear,festival] of costumeFamilies){
    assert.equal(styles.filter(style=>style.costume===sportswear).length,10)
    const featured=styles.filter(style=>style.costume===festival)
    assert.equal(featured.length,5)
    assert.equal(new Set(featured.map(style=>style.palette)).size,5)
  }
  assert.equal(starterStyle.costume,undefined)
})

test('a saved main color retains a contrasting accent and does not affect assignment',()=>{
  const people=fixture().people
  const original=assignAvatarStyles(people)
  const person=people[0]
  const style=original.get(person.id)!
  const changed=assignAvatarStyles([{...person,color:style.accent.toUpperCase()},...people.slice(1)])
  assert.deepEqual(changed.get(person.id),{...style,primary:style.accent.toUpperCase(),accent:style.primary})
  assert.deepEqual(changed.get(people[1].id),original.get(people[1].id))
})
