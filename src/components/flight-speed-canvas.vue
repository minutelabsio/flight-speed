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
      // , backgroundColor: 0x335533
    })

    app.renderer.autoResize = true
    app.renderer.view.style.position = 'absolute'
    app.renderer.view.style.display = 'block'

    const center = new PIXI.Point(0, 0)
    const viewport = new Viewport({
      screenWidth: this.dimensions.width
      , screenHeight: this.dimensions.height
      , worldWidth: 10
      , worldHeight: 100000
      , interaction: app.renderer.plugins.interaction
      , center
      , passiveWheel: false
    })

    viewport
      .drag()
      .decelerate()
      .pinch({ })
      .wheel({ smooth: 20 })
      .clampZoom({
        minHeight: 100
        , maxHeight: 100000
      })
      .clamp({
        top: -100000
        , bottom: 100000
        , left: 0
        , right: 0
      })
    // viewport.snap(0, 0, { time: 0 })
    viewport.ensureVisible(-this.dimensions.width/2, -this.dimensions.height/2, this.dimensions.width, this.dimensions.height)

    app.stage.addChild(viewport)

    this.stage = app.stage
    this.stage.sortableChildren = true
    this.viewport = viewport
    this.viewport.zIndex = 10
    this.stage.addChild(this.viewport)

    // this.viewport.addChild(this.makeGuides())

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

      let scale = 0.5

      this.createFlyer({
        textureName: 'nyan'
        , y: 0
        , speed: 4
        , scale: 0.1 * scale
      })

      this.createFlyer({
        textureName: 'nyan'
        , y: -500
        , speed: 7
        , scale: 0.4 * scale
      })

      this.createFlyer({
        textureName: 'nyan'
        , y: -1300
        , speed: 15
        , scale: 0.6 * scale
      })

      this.initBg()

      const draw = this.draw.bind(this)
      this.app.ticker.add(draw)
    }
    , makeGuides(){
      // guides
      let width = 200000
      let guides = new PIXI.Graphics()
      guides.lineStyle(2, 0xff4444, 1)
      guides.moveTo(0, 0)
      guides.lineTo(width, 0)
      guides.moveTo(0, 0)
      guides.lineTo(0, width)

      // guides.lineStyle(2, 0x4444ff, 1)
      // let v = this.viewport
      // guides.moveTo(v.left, v.top)
      // guides.lineTo(v.left, v.bottom)
      // guides.lineTo(v.right, v.bottom)
      // guides.lineTo(v.right, v.top)
      // guides.lineTo(v.left, v.top)

      guides.alpha = 0.4
      guides.zIndex = -1
      return guides
    }
    , initBg(){
      let texture = Loader.resources.cityTile.texture
      let tile = new PIXI.TilingSprite(texture, this.dimensions.width, this.dimensions.height)
      tile.alpha = 0.6

      this.viewport.on('moved', () => {
        let x = this.viewport.center.x
        let y = -this.viewport.center.y
        let scale = this.viewport.scaled
        tile.tilePosition.set(x * scale, y * scale)
      })

      this.stage.addChild(tile)
    }
    , createFlyer( cfg ){

      let container = new PIXI.Container()
      // container.interactive = true
      // container.interactiveChildren = true
      container.sortableChildren = true
      container.y = cfg.y

      // flying thing
      let texture = Loader.resources[cfg.textureName].texture
      let sprite = new PIXI.Graphics()
      let image = new PIXI.Sprite(texture)
      let scale = cfg.scale * 1000 / texture.width
      let width = texture.width * scale
      image.scale.set(scale, scale)
      image.anchor.set(0.5, 0.5)
      // image.rotation = Math.PI / 2

      sprite.position.set(cfg.x || this.viewport.right + SCREEN_MARGIN, 0)
      sprite.moveSpeed = cfg.speed
      sprite.zIndex = 10
      sprite.addChild(image)

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
        e.stopPropagation()
        track.data = e.data
        track.dragging = true
      }).on('pointermove', () => {
        if ( track.dragging ){
          const newPosition = track.data.getLocalPosition(container.parent)
          const bot = this.viewport.bottom
          const top = this.viewport.top
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

      container.addChild(track)

      // trail
      let trailWidth = 100 * cfg.speed
      let canvas = document.createElement('canvas')
      canvas.width = trailWidth
      canvas.height = 2
      let ctx = canvas.getContext('2d')
      let gradient = ctx.createLinearGradient(0, 0, trailWidth, 0)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
      gradient.addColorStop(1, '#ffff00')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, trailWidth, 2)
      let trail = new PIXI.Sprite(PIXI.Texture.from(canvas))
      trail.anchor.set(1, 0.5)
      trail.x = -image.width / 2
      sprite.addChild(trail)

      this.viewport.on('zoomed', (e) => {
        // unzoom the track
        const v = e.viewport
        const s = 1 / v.scaled
        track.scale.set(1, s)
        trail.scale.set(1, s)
      })

      this.viewport.addChild(container)

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

      if ( (x - hw - SCREEN_MARGIN) > this.viewport.right ){
        x = this.viewport.left - (hw + SCREEN_MARGIN)
      }

      if ( (x + hw + SCREEN_MARGIN) < this.viewport.left ){
        x = this.viewport.right + hw + SCREEN_MARGIN
      }

      obj.position.set(x, y)
    }
  }
  , render(h){
    return h('div')
  }
}
</script>
