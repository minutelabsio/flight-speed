<script>
import _debounce from 'lodash/debounce'
import { Loader, loadSprites } from '@/components/sprites'
import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'

const SCREEN_MARGIN = 100

// function ignoreUselessErrors(error){
//   if ( error.message.match('Resource named') ){
//     return
//   }
//
//   return Promise.reject(error)
// }

function resizeHooks(self){
  const resize = _debounce(function(){
    self.$emit('resize')
  }, 100)

  window.addEventListener('resize', resize, { passive: true })
  self.$on('hook:beforeDestroy', () => {
    window.removeEventListener('resize', resize)
  })
}

export default {
  name: 'FlightSpeedCanvas'
  , props: {
  }
  , components: {}
  , data: () => ({
    dimensions: {
      width: window.innerWidth
      , height: window.innerHeight
    }
  })
  , created(){

    resizeHooks(this)

    this.$on('resize', () => {
      this.dimensions = {
        width: window.innerWidth
        , height: window.innerHeight
      }
    })

    // pixi
    let app = this.app = new PIXI.Application({
      width: this.dimensions.width
      , height: this.dimensions.height
      , antialias: true    // default: false
      , transparent: false // default: false
      , resolution: 1      // default:
      , backgroundColor: 0x335533
    })

    app.renderer.autoResize = true
    app.renderer.view.style.position = 'absolute'
    app.renderer.view.style.display = 'block'

    const center = new PIXI.Point(0, 0)
    const viewport = new Viewport({
      screenWidth: this.dimensions.width
      , screenHeight: this.dimensions.width
      , interaction: app.renderer.plugins.interaction
      , center
    })

    viewport.pinch({ center }).wheel({ center })
    viewport.snap(0, 0, { time: 0 })

    app.stage.addChild(viewport)

    this.stage = app.stage
    this.stage.sortableChildren = true
    this.flyerContainer = viewport
    this.flyerContainer.zIndex = 10
    this.stage.addChild(this.flyerContainer)

    this.init()
  }
  , beforeDestroy(){
    this.app.destroy(true, { children: true })
  }
  , watch: {
    dimensions(){
      let w = this.dimensions.width
      let h = this.dimensions.height
      this.app.renderer.resize(w, h)
    }
  }
  , mounted(){
    this.$el.appendChild(this.app.view)
  }
  , methods: {
    async init(){
      await loadSprites()

      this.flyers = []

      this.createFlyer({
        textureName: 'testDrag'
        , y: 0
        , speed: 4
        , scale: 0.2
      })

      const draw = this.draw.bind(this)
      this.app.ticker.add(draw)
    }
    , createFlyer( cfg ){

      let container = new PIXI.Container()
      // container.interactive = true
      // container.interactiveChildren = true
      container.sortableChildren = true
      container.y = cfg.y

      // flying thing
      let texture = Loader.resources[cfg.textureName].texture
      let sprite = new PIXI.Sprite(texture)
      let aspect = 1000 / texture.width
      sprite.width = 1000
      sprite.height = aspect * texture.height
      sprite.scale.set(cfg.scale, cfg.scale)
      sprite.anchor.set(0.5, 0.5)
      sprite.rotation = -Math.PI / 2
      sprite.position.set(cfg.x || this.flyerContainer.right + SCREEN_MARGIN, 0)
      sprite.moveSpeed = -cfg.speed
      sprite.zIndex = 10

      container.addChild(sprite)

      // track
      let track = new PIXI.Graphics()
      track.interactive = true
      track.lineStyle(2, 0x888888, 1)
      track.moveTo(0, 0)
      track.lineTo(200000, 0)
      track.alpha = 0.4
      // track.beginFill(0xFF9933)
      // track.drawRoundedRect(0, 0, 20000, 2, 0)
      // track.endFill()
      track.x = -100000
      track.y = 0
      track.zIndex = -1
      track.hitArea = new PIXI.Rectangle(0, -20, 200000, 40)
      track.cursor = 'pointer'

      track.on('pointerover', () => {
        track.alpha = 1
      }).on('pointerout', () => {
        track.alpha = 0.4
      }).on('pointerdown', (e) => {
        track.data = e.data
        track.dragging = true
      }).on('pointermove', () => {
        if ( track.dragging ){
          const newPosition = track.data.getLocalPosition(container.parent)
          const bot = this.flyerContainer.bottom
          const top = this.flyerContainer.top
          const newY = Math.max(top, Math.min(bot, newPosition.y))
          container.y = newY
        }
      })
      .on('pointerup', stopDrag)
      .on('pointerupoutside', stopDrag)

      function stopDrag(){
        track.data = null
        track.dragging = false
      }

      this.flyerContainer.on('zoomed', (e) => {
        const v = e.viewport
        const s = 1 / v.scaled
        track.scale.set(1, s)
      })

      container.addChild(track)
      this.flyerContainer.addChild(container)

      this.flyers.push({
        sprite
        , track
        , container
      })
    }
    , draw(dt){
      this.animateFlyers(dt)
    }
    , animateFlyers(dt){
      for (let i = 0, l = this.flyers.length; i < l; i++){
        this.moveWrap(this.flyers[i].sprite, dt)
      }
    }
    , moveWrap(obj, dt){
      let v = obj.moveSpeed
      let hw = 0.5 * obj.width
      let {x,y} = obj.position

      x += v * dt

      if ( (x + hw + SCREEN_MARGIN) < this.flyerContainer.left ){
        x = this.flyerContainer.right + hw + SCREEN_MARGIN
      }

      obj.position.set(x, y)
    }
  }
  , render(h){
    return h('div')
  }
}
</script>
