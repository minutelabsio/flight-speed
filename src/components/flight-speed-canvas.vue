<script>
import Promise from 'bluebird'
import _debounce from 'lodash/debounce'
import _throttle from 'lodash/throttle'
import { tween } from 'shifty'
import { unit } from 'mathjs'
import { Loader, loadSprites } from '@/components/sprites'
import * as PIXI from 'pixi.js'
import { DropShadowFilter } from '@pixi/filter-drop-shadow'
import { Viewport } from 'pixi-viewport'
import Creatures from '@/config/creatures.yaml'

const svgResources = {
  'bee': require('@/assets/bee.svg')
}

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

function lengthScale( maxWidth = 400 ){
  let unitWidth = maxWidth / 2
  let graphics = new PIXI.Graphics()
  let text = new PIXI.Text('0', {
    fontFamily: 'latin-modern-mono'
    , fontSize: 14
    , fill: 0xffffff
    , align: 'center'
  })
  text.anchor.set(0.5)
  graphics.addChild(text)

  function formatUnits( d ){
    let v = unit(d, 'm')
    return v.toString()
  }

  function setScale( s ){
    let units = Math.pow(10, Math.ceil(Math.log10(1/s)))
    let targetWidth = s * unitWidth

    if ( (units * targetWidth) > maxWidth ){
      units *= 0.1
    }

    graphics.clear()
    graphics.lineStyle(2, 0xffffff, 1)
    graphics.moveTo(0, 0)
    graphics.lineTo(-targetWidth * units, 0)
    text.text = formatUnits(units)
    text.position.set(-targetWidth * units/2, -20)
  }

  return {
    setScale
    , graphics
  }
}

function resourceToGraphics( name, scale = 1 ){
  let image
  let resource = svgResources[name]

  if ( resource ){
    // resource = new PIXI.resources.SVGResource()
    image = new PIXI.Sprite.from(resource, { scale: 100 })
  } else {
    resource = Loader.resources[name].texture
    image = new PIXI.Sprite(resource)
  }

  let s = scale * 1000 / image.texture.width
  image.scale.set(s, s)

  image.anchor.set(0.5, 0.5)
  return image
}

function makeOffscreenThumb( resource ){
  let offscreenIndicator = new PIXI.Graphics()
  let bubble = new PIXI.Graphics()
  let r = 30
  bubble.beginFill(0xffffff, 1)
  bubble.drawCircle(0, 0, r)
  bubble.drawPolygon([-12, r - 6, 0, r + 8, 12, r - 6])
  bubble.endFill()
  bubble.rotation = Math.PI
  bubble.name = 'bubble'
  let thumb = resourceToGraphics(resource)
  let s = thumb.scale.x * (2 * r - 10) / Math.max(thumb.width, thumb.height)
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

    this.stage = app.stage
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
        , maxHeight: 300000
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
    viewport.zIndex = 8

    viewport.on('zoomed', () => {
      this.$emit('zoom', this.viewport.scaled)
    })

    this.shadowFilter = new DropShadowFilter({
      shadowOnly: false
      , rotation: 90.1
      , distance: 0
      , blur: 2
      , quality: 5
      , alpha: 0.3
    })

    this.$on('zoom', (scale) => {
      this.shadowFilter.distance = 500 * scale
    })

    this.creaturesLayer = new PIXI.Container()
    this.creaturesLayer.sortableChildren = true
    this.creaturesLayer.zIndex = 8
    this.creaturesLayer.filters = [this.shadowFilter]
    this.viewport.addChild(this.creaturesLayer)

    this.trackLayer = new PIXI.Container()
    this.trackLayer.zIndex = 0
    this.viewport.addChild(this.trackLayer)

    this.stage.sortableChildren = true
    this.stage.addChild(this.viewport)

    this.bubbleLayer = new PIXI.Container()
    this.bubbleLayer.zIndex = 11
    this.stage.addChild(this.bubbleLayer)

    this.entranceOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this.entranceOverlay.width = this.dimensions.width
    this.entranceOverlay.height = this.dimensions.height
    this.entranceOverlay.zIndex = 1000
    this.stage.addChild(this.entranceOverlay)

    // this.viewport.addChild(this.makeGuides())

    this.$watch('dimensions', ({ width, height }) => {
      viewport.resize(width, height)
      viewport.snap(0, 0, { time: 0 })
      app.renderer.resize(width, height)
    })

    this.init()
  }
  , beforeDestroy(){
    this.app.destroy(true, { children: true })
  }
  , watch: {
  }
  , mounted(){
    this.$el.appendChild(this.app.view)
  }
  , methods: {
    async init(){
      await loadSprites()

      this.creatures = []

      Creatures.forEach(c => {
        this.createFlyer({
          resource: c.image
          , x: this.viewport.left / 4
          , y: c.position.y
          , speed: c.speed
          , scale: Math.sqrt(c.size)
        })
      })

      this.initBg()
      this.initLengthScale()
      this.initLaunchers()

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
        , delay: 0
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
        , easing: 'easeInOutSine'
        , step: state => {
          this.zoom( state.zoom )
        }
      })
    }
    , initLengthScale(){
      let ls = lengthScale()
      ls.graphics.zIndex = 9
      ls.graphics.position.set(this.dimensions.width - 50, this.dimensions.height - 50)
      ls.setScale(1)

      this.$on('zoom', s => {
        ls.setScale(s)
      })

      this.$watch('dimensions', ({ width, height }) => {
        ls.graphics.position.set(width - 50, height - 50)
      })

      this.stage.addChild(ls.graphics)
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
        let parallax = Math.pow(scale, 0.1)
        tile.tileScale.set(parallax, parallax)
      })

      this.$watch('dimensions', ({ width, height }) => {
        tile.width = width
        tile.height = height
      })

      this.stage.addChild(tile)
    }
    , initLaunchers(){
      this.launchersLayer = new PIXI.Container()
      let bg = new PIXI.Sprite(PIXI.Texture.WHITE)
      bg.width = 380
      bg.height = 120
      bg.alpha = 0.3
      this.launchersLayer.addChild(bg)
      this.launchersLayer.zIndex = 12
      this.stage.addChild(this.launchersLayer)

      this.createLaunchable({
        ...Creatures[0]
        , resource: Creatures[0].image
        , scale: 0.15
        , x: 100
        , y: 60
      })

      this.createLaunchable({
        ...Creatures[5]
        , resource: Creatures[5].image
        , scale: 0.15
        , x: 260
        , y: 55
      })
    }
    , createFlyer( cfg ){

      const viewport = this.viewport
      // let motionBlur = new MotionBlurFilter({})
      // flying thing
      let movingGraphic = new PIXI.Graphics()
      let image = resourceToGraphics(cfg.resource, cfg.scale)
      // image.rotation = Math.PI / 2

      movingGraphic.position.set(cfg.x || this.viewport.right + SCREEN_MARGIN, 0)
      movingGraphic.zIndex = Math.floor(1 / cfg.scale)
      // movingGraphic.filters = [motionBlur]
      movingGraphic.addChild(image)

      this.creaturesLayer.addChild(movingGraphic)

      // track
      let track = new PIXI.Graphics()
      track.interactive = true
      track.lineStyle(2, 0x888888, 1)
      track.moveTo(0, 0)
      track.lineTo(400000, 0)
      track.alpha = 0.1
      // track.beginFill(0xFF9933)
      // track.drawRoundedRect(0, 0, 20000, 2, 0)
      // track.endFill()
      track.x = -200000
      track.y = 0
      track.zIndex = -1
      track.hitArea = new PIXI.Rectangle(0, -20, 400000, 40)
      track.cursor = 'grab'

      track.on('pointerover', () => {
        track.alpha = 1
      }).on('pointerout', () => {
        track.alpha = 0.1
      }).on('pointerdown', (e) => {
        // if mousebutton is used and it's not left btn, this will be non-zero
        if ( e.data.originalEvent.button ){ return }
        e.stopPropagation()
        track.data = e.data
        track.cursor = 'grabbing'
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
        track.cursor = 'grab'
        track.dragging = false
      }

      this.$on('zoom', scale => {
        // unzoom the track
        const s = 1 / scale
        track.scale.set(1, s)
        trail.scale.set(1, s)
        // motionBlur.velocity.x = cfg.speed * scale * 2
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

      let offscreenIndicator = makeOffscreenThumb(cfg.resource)
      offscreenIndicator.position.set(100, 40)
      offscreenIndicator.zIndex = 10
      offscreenIndicator.buttonMode = true
      offscreenIndicator.interactive = true
      this.bubbleLayer.addChild(offscreenIndicator)

      function setYPosition( y ){
        movingGraphic.position.y = y
        track.position.y = y
      }

      function setXPosition( x ){
        movingGraphic.position.x = x
        offscreenIndicator.position.x = viewport.toScreen(x, 0).x
      }

      function show(){
        movingGraphic.visible = true
        track.visible = true
        offscreenIndicator.visible = true
      }

      function hide(){
        movingGraphic.visible = false
        track.visible = false
        offscreenIndicator.visible = false
      }

      const destroy = () => {
        let idx = this.creatures.indexOf(creature)
        if ( idx > -1 ){
          this.creatures.splice(idx, 1)
        }

        this.bubbleLayer.removeChild(offscreenIndicator)
        this.trackLayer.removeChild(track)
        this.creaturesLayer.removeChild(movingGraphic)
      }

      const creature = {
        movingGraphic
        , track
        , speed: cfg.speed
        , paused: false
        , setXPosition
        , setYPosition
        , show
        , hide
        , destroy
      }

      const handleZoom = () => {
        let y = movingGraphic.position.y
        let margin = movingGraphic.height * 0.6
        let isAbove = (y + margin) < viewport.top
        let isBelow = (y - margin) > viewport.bottom
        let isOffscreen = isAbove || isBelow

        if ( isOffscreen !== offscreenIndicator.visible ){
          creature.paused = false
          offscreenIndicator.visible = isOffscreen
          offscreenIndicator.getChildByName('bubble').rotation = isAbove ? Math.PI : 0
          offscreenIndicator.position.y = isAbove ? 45 : this.dimensions.height - 45
        }
      }

      this.$on('zoom', handleZoom)
      this.$watch('dimensions', handleZoom)

      offscreenIndicator.on('click', () => {
        this.zoomToCreature(creature)
      }).on('pointerover', () => {
        if ( creature.grabbing ){ return }
        creature.paused = true
      }).on('pointerout', () => {
        if ( creature.grabbing ){ return }
        creature.paused = false
      })

      setYPosition( cfg.y )
      handleZoom()
      this.creatures.push(creature)
      return creature
    }
    , createLaunchable( cfg = {} ){
      const viewport = this.viewport
      const throttleTime = 1
      const handle = new PIXI.Graphics()
      handle.interactive = true
      handle.cursor = 'grab'
      handle.position.set(cfg.x, cfg.y)
      const image = resourceToGraphics(cfg.resource, cfg.scale)
      handle.addChild(image)

      let creature
      let screenPos
      let lastPos
      let lastTime = 0
      let speed
      const grab = e => {
        if ( e.data.originalEvent.button ){ return }
        e.stopPropagation()
        handle.data = e.data
        handle.cursor = 'grabbing'
        handle.dragging = true
        creature = this.createFlyer({ ...cfg, scale: Math.sqrt(cfg.size) })
        creature.paused = true
        creature.grabbing = true
        screenPos = handle.data.getLocalPosition(handle.parent)
        lastPos = viewport.toWorld(screenPos)

        let zoom = cfg.scale / Math.sqrt(cfg.size)
        this.animateZoomTo(zoom, 200, () => {
          if ( !creature.grabbing ){ return }
          let pos = viewport.toWorld(screenPos)
          creature.setXPosition(pos.x)
          creature.setYPosition(pos.y)
        })
      }

      const move = e => {
        if ( !handle.dragging ){ return }
        screenPos = handle.data.getLocalPosition(handle.parent)
        const pos = viewport.toWorld(screenPos)
        creature.setXPosition(pos.x)
        creature.setYPosition(pos.y)

        const time = performance.now()
        let dt = Math.max(time - lastTime, throttleTime)

        speed = Math.max((pos.x - lastPos.x) / dt, 0)

        lastPos = pos
        lastTime = time
      }

      const fly = (creature, speed) => {
        tween({
          from: { speed }
          , to: { speed: cfg.speed }
          , delay: 0
          , duration: 3000
          , easing: 'easeOutQuad'
          , step: state => {
            creature.speed = state.speed
          }
        })
      }

      const fall = creature => {
        creature.movingGraphic.zIndex = 0
        tween({
          from: { speed, scale: creature.movingGraphic.scale.x }
          , to: { speed: 0, scale: 0 }
          , delay: 0
          , duration: 3000
          , easing: 'easeOutQuad'
          , step: state => {
            creature.speed = state.speed
            creature.movingGraphic.scale.set(state.scale, state.scale)
          }
        }).then(() => {
          creature.destroy()
        })
      }

      const release = e => {
        handle.data = null
        handle.cursor = 'grab'
        handle.dragging = false
        creature.paused = false
        creature.grabbing = false

        if ( speed >= cfg.speed ){
          fly(creature, speed)
        } else {
          fall(creature)
        }
      }

      handle.on('pointerdown', grab)
        .on('pointermove', move)
        .on('pointerup', release)
        .on('pointerupoutside', release)

      this.launchersLayer.addChild(handle)
    }
    , draw(dt){
      if ( this.paused ){ return }
      this.animateFlyers(dt)
    }
    , animateFlyers(dt){
      for (let i = 0, l = this.creatures.length; i < l; i++){
        let creature = this.creatures[i]
        if ( !creature.paused ){
          this.moveWrap(creature, dt)
        }
      }
    }
    , moveWrap(creature, dt){
      let obj = creature.movingGraphic
      let v = creature.speed
      let hw = 0.5 * obj.width
      let { x } = obj.position

      x += v * dt

      if ( v > 0 ){
        if ( (x - hw - SCREEN_MARGIN) > this.viewport.right ){
          x = this.viewport.left - hw
        }

        if ( (x + hw + SCREEN_MARGIN) < this.viewport.left ){
          x = this.viewport.left - hw
        }
      }

      if ( v < 0 ){
        if ( (x + hw + SCREEN_MARGIN) < this.viewport.left ){
          x = this.viewport.right + hw
        }

        if ( (x - hw - SCREEN_MARGIN) > this.viewport.right ){
          x = this.viewport.left - hw
        }
      }

      creature.setXPosition(x)
    }
    , zoomToCreature(creature){
      const vp = this.viewport
      let hh = Math.abs(creature.movingGraphic.position.y)
      let zoom = vp.screenHeight / (2 * hh + creature.movingGraphic.height)

      this.animateZoomTo(zoom)
    }
    , animateZoomTo( zoom, duration = 1000, step ){
      const vp = this.viewport
      tween({
        from: { zoom: vp.scaled }
        , to: { zoom }
        , delay: 0
        , duration
        , easing: 'easeOutQuad'
        , step: state => {
          this.zoom( state.zoom )
          if ( step ){
            step()
          }
        }
      })
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
