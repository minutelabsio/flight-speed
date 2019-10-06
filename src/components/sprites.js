import * as PIXI from 'pixi.js'

export const Loader = PIXI.Loader.shared

const SPRITES = {
  'testDrag': require('@/assets/dragon-test.png')
  , 'nyan0': require('@/assets/nyan.png')
  , 'nyan1': require('@/assets/nyan-jackson.gif')
  , 'nyan2': require('@/assets/nyan-balloon.gif')
  , 'nyan3': require('@/assets/nyan-zombie.gif')
  , 'nyan4': require('@/assets/nyan-coin.gif')
  , 'nyan5': require('@/assets/nyan-pumpkin.gif')
  , 'cityTile': require('@/assets/bg.jpg')
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
