import * as PIXI from 'pixi.js'
// import Creatures from '@/config/creatures.yaml'

export const Loader = PIXI.Loader.shared

const SPRITES = {
  'Autumn-Darter-Dragonfly.png': require('@/assets/creatures/Autumn-Darter-Dragonfly.png')
  , 'Blue-Jay.png': require('@/assets/creatures/Blue-Jay.png')
  , 'Boeing-747-400.png': require('@/assets/creatures/Boeing-747-400.png')
  , 'Canada-Goose.png': require('@/assets/creatures/Canada-Goose.png')
  , 'Hungarian-Horntail.png': require('@/assets/creatures/Hungarian-Horntail.png')
  , 'Little-Brown-Bat.png': require('@/assets/creatures/Little-Brown-Bat.png')
  , 'Fly.png': require('@/assets/creatures/Fly.png')
  , 'Paper-Plane.png': require('@/assets/creatures/Paper-Plane.png')
  , 'Pterosaur.png': require('@/assets/creatures/Pterosaur.png')
  , 'Smaug.png': require('@/assets/creatures/Smaug.png')
  , 'Skyrim.png': require('@/assets/creatures/Skyrim.png')
  , 'Vermithrax.png': require('@/assets/creatures/Vermithrax.png')
  , 'Wandering-Albatross.png': require('@/assets/creatures/Wandering-Albatross.png')
  , 'background': require('@/assets/ML 12 - Ground.jpg')
  , 'clouds': require('@/assets/ML 12 - Sky.png')
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
