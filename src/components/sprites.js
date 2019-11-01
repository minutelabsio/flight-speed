import * as PIXI from 'pixi.js'
// import Creatures from '@/config/creatures.yaml'

export const Loader = PIXI.Loader.shared

const SPRITES = {
  'Autumn-Darter-Dragonfly.png': require('@/assets/creatures/Autumn-Darter-Dragonfly.png')
  , 'Boeing-747-400.png': require('@/assets/creatures/Boeing-747-400.png')
  , 'Canada-Goose.png': require('@/assets/creatures/Canada-Goose.png')
  , 'Fly.png': require('@/assets/creatures/Fly.png')
  , 'Paper-Plane.png': require('@/assets/creatures/Paper-Plane.png')
  , 'Smaug.png': require('@/assets/creatures/Smaug.png')
  , 'background': require('@/assets/ML 12 - Ground.jpg')
  , 'clouds': require('@/assets/ML 12 - Clouds.png')
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
