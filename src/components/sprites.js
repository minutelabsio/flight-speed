import * as PIXI from 'pixi.js'

export const Loader = PIXI.Loader.shared

const SPRITES = {
  'testDrag': require('@/assets/dragon-test.png')
  , 'nyan': require('@/assets/nyan.png')
}

let LOAD_SPRITES_PROMISE = null
export function loadSprites(){
  if ( !LOAD_SPRITES_PROMISE ){
    LOAD_SPRITES_PROMISE = new Promise((resolve) => {
      Object.keys(SPRITES).forEach(k => Loader.add(k, SPRITES[k]))
      Loader.load(resolve)
    })
  }
  return LOAD_SPRITES_PROMISE
}
