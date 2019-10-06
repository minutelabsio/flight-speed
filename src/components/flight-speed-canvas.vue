<script>
import Promise from 'bluebird'
import _debounce from 'lodash/debounce'
import { tween } from 'shifty'
import { Loader, loadSprites } from '@/components/sprites'
import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'

const SCREEN_MARGIN = 50

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

function makeOffscreenThumb( texture ){
  let offscreenIndicator = new PIXI.Graphics()
  let bubble = new PIXI.Graphics()
  let r = 30
  bubble.beginFill(0xffffff, 1)
  bubble.drawCircle(0, 0, r)
  bubble.drawPolygon([-12, r - 6, 0, r + 8, 12, r - 6])
  bubble.endFill()
  bubble.rotation = Math.PI
  bubble.name = 'bubble'
  let thumb = new PIXI.Sprite(texture)
  let s = (2 * r - 10) / Math.max(texture.width, texture.height)
  thumb.scale.set(s, s)
  thumb.anchor.set(0.5, 0.5)
  offscreenIndicator.addChild(bubble)
  offscreenIndicator.addChild(thumb)

  return offscreenIndicator
}

export default {
  name: 'FlightSpeedCanvas'
  , props: {
  }
  , components: {}
  , data: () => ({
    paused: true
    , dimensions: {
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

    this.viewport = viewport

    viewport
      // .drag()
      .decelerate()
      .pinch({ center })
      .wheel({ center, smooth: 20 })
      .clampZoom({
        minHeight: 100
        , maxHeight: 100000
      })
      // .clamp({
      //   top: -100000
      //   , bottom: 100000
      //   , left: 0
      //   , right: 0
      // })
    // viewport.snap(0, 0, { time: 0 })
    viewport.ensureVisible(-this.dimensions.width/2, -this.dimensions.height/2, this.dimensions.width, this.dimensions.height)
    viewport.sortableChildren = true
    viewport.zIndex = 10

    viewport.on('zoomed', () => {
      this.$emit('zoom', this.viewport.scaled)
    })

    this.flyersLayer = new PIXI.Container()
    this.flyersLayer.sortableChildren = true
    this.flyersLayer.zIndex = 10
    this.viewport.addChild(this.flyersLayer)

    this.trackLayer = new PIXI.Container()
    this.trackLayer.zIndex = 0
    this.viewport.addChild(this.trackLayer)

    this.stage = app.stage
    this.stage.sortableChildren = true
    this.stage.addChild(this.viewport)

    this.entranceOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this.entranceOverlay.width = this.dimensions.width
    this.entranceOverlay.height = this.dimensions.height
    this.entranceOverlay.zIndex = 1000
    this.stage.addChild(this.entranceOverlay)

    // this.viewport.addChild(this.makeGuides())

    this.$watch('dimensions', ({ width, height }) => {
      viewport.resize(width, height)
      viewport.snap(0, 0, { time: 0 })
    })

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

      let scale = 0.01

      function getScale( speed ){
        return speed * speed * scale
      }

      for ( let i = 0; i < 6; i++ ){
        let speed = 4 * i + 4
        this.createFlyer({
          textureName: 'nyan'+i
          , x: this.viewport.left / 4
          , y: i * 600 * getScale(speed) * (i % 2 ? 1 : -1)
          , speed
          , scale: getScale(speed)
        })
      }

      this.initBg()

      const draw = this.draw.bind(this)
      this.app.ticker.add(draw)
      this.animateEntrance()
      Promise.delay(200).then(() => {
        this.paused = false
      })
    }
    , animateEntrance(){
      this.zoom( 0.01 )

      tween({
        from: { opacity: 1 }
        , to: { opacity: 0 }
        , delay: 500
        , duration: 2000
        , easing: 'easeInOutQuad'
        , step: state => {
          this.entranceOverlay.alpha = state.opacity
        }
      })

      return tween({
        from: { zoom: 0.01 }
        , to: { zoom: 0.1 }
        , delay: 1000
        , duration: 4000
        , easing: 'easeInOutQuad'
        , step: state => {
          this.zoom( state.zoom )
        }
      })
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
      let {width, height} = this.dimensions
      let tile = new PIXI.TilingSprite(texture, width, height)
      tile.alpha = 0.6
      tile.tilePosition.set(width/2, height/2)

      // this.viewport.on('moved', () => {
      //   let x = this.viewport.center.x
      //   let y = -this.viewport.center.y
      //   let scale = this.viewport.scaled
      //   console.log(scale)
      //   // let parallax = scale * 0.1
      //   tile.tilePosition.set(x * scale, y * scale)
      //   // tile.tileScale.set(parallax, parallax)
      // })

      this.$on('zoom', scale => {
        let parallax = Math.pow(scale, 0.05)
        tile.tileScale.set(parallax, parallax)
      })

      this.$watch('dimensions', ({ width, height }) => {
        tile.width = width
        tile.height = height
      })

      this.stage.addChild(tile)
    }
    , createFlyer( cfg ){

      const viewport = this.viewport
      // flying thing
      let texture = Loader.resources[cfg.textureName].texture
      let movingGraphic = new PIXI.Graphics()
      let image = new PIXI.Sprite(texture)
      let scale = cfg.scale * 1000 / texture.width
      let width = texture.width * scale
      image.scale.set(scale, scale)
      image.anchor.set(0.5, 0.5)
      // image.rotation = Math.PI / 2

      movingGraphic.position.set(cfg.x || this.viewport.right + SCREEN_MARGIN, 0)
      movingGraphic.moveSpeed = cfg.speed
      movingGraphic.zIndex = Math.floor(1 / cfg.scale)
      movingGraphic.addChild(image)

      this.flyersLayer.addChild(movingGraphic)

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
        // if mousebutton is used and it's not left btn, this will be non-zero
        if ( e.data.originalEvent.button ){ return }
        e.stopPropagation()
        track.data = e.data
        track.dragging = true
      }).on('pointermove', () => {
        if ( track.dragging ){
          const newPosition = track.data.getLocalPosition(track.parent)
          const bot = this.viewport.bottom
          const top = this.viewport.top
          const newY = Math.max(top, Math.min(bot, newPosition.y))
          setYPosition( newY )
        }
      })
      .on('pointerup', stopDrag)
      .on('pointerupoutside', stopDrag)

      function stopDrag(){
        track.data = null
        track.dragging = false
      }

      this.$on('zoom', scale => {
        // unzoom the track
        const s = 1 / scale
        track.scale.set(1, s)
        trail.scale.set(1, s)
      })

      this.trackLayer.addChild(track)

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
      movingGraphic.addChild(trail)

      let offscreenIndicator = makeOffscreenThumb(texture)
      offscreenIndicator.position.set(100, 40)
      offscreenIndicator.zIndex = 10
      this.stage.addChild(offscreenIndicator)

      this.$on('zoom', () => {
        let y = movingGraphic.position.y
        let margin = movingGraphic.height * 0.6
        let isAbove = (y + margin) < viewport.top
        let isBelow = (y - margin) > viewport.bottom
        let isOffscreen = isAbove || isBelow

        if ( isOffscreen !== offscreenIndicator.visible ){
          offscreenIndicator.visible = isOffscreen
          offscreenIndicator.getChildByName('bubble').rotation = isAbove ? Math.PI : 0
          offscreenIndicator.position.y = isAbove ? 45 : this.dimensions.height - 45
        }
      })

      function setYPosition( y ){
        movingGraphic.position.y = y
        track.position.y = y
      }

      function setXPosition( x ){
        movingGraphic.position.x = x
        offscreenIndicator.position.x = viewport.toScreen(x, 0).x
      }

      setYPosition( cfg.y )

      this.flyers.push({
        movingGraphic
        , track
        , setXPosition
        , setYPosition
      })
    }
    , draw(dt){
      if ( this.paused ){ return }
      this.animateFlyers(dt)
    }
    , animateFlyers(dt){
      for (let i = 0, l = this.flyers.length; i < l; i++){
        this.moveWrap(this.flyers[i], dt)
      }
    }
    , moveWrap(flyer, dt){
      let obj = flyer.movingGraphic
      let v = obj.moveSpeed
      let hw = 0.5 * obj.width
      let { x } = obj.position

      x += v * dt

      if ( v > 0 ){
        if ( (x - hw - SCREEN_MARGIN) > this.viewport.right ){
          x = this.viewport.left - (hw + SCREEN_MARGIN)
        }

        if ( (x + hw + SCREEN_MARGIN) < this.viewport.left ){
          x = this.viewport.left - (hw + SCREEN_MARGIN)
        }
      }

      if ( v < 0 ){
        if ( (x + hw + SCREEN_MARGIN) < this.viewport.left ){
          x = this.viewport.right + hw + SCREEN_MARGIN
        }

        if ( (x - hw - SCREEN_MARGIN) > this.viewport.right ){
          x = this.viewport.left - (hw + SCREEN_MARGIN)
        }
      }

      flyer.setXPosition(x)
    }
    , zoom( scale ){
      this.viewport.setZoom( scale )
      this.$emit('zoom', scale)
    }
  }
  , render(h){
    return h('div')
  }
}
</script>
