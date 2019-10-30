import * as PIXI from 'pixi.js'
// import Creatures from '@/config/creatures.yaml'

export const Loader = PIXI.Loader.shared

const SPRITES = {
  'testDrag': require('@/assets/dragon-test.png')
  // , 'nyan.png': require('@/assets/creatures/nyan.png')
  // , 'nyan-jackson.gif': require('@/assets/creatures/nyan-jackson.gif')
  // , 'nyan2': require('@/assets/creatures/nyan-balloon.gif')
  // , 'nyan3': require('@/assets/creatures/nyan-zombie.gif')
  // , 'nyan4': require('@/assets/creatures/nyan-coin.gif')
  // , 'nyan5': require('@/assets/creatures/nyan-pumpkin.gif')
  , 'cityTile': require('@/assets/bg.jpg')
  , 'background': require('@/assets/ML 12 - Background.jpg')
  , '747-test.png': require('@/assets/creatures/747-test.png')
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
