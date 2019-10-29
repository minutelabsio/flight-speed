<template lang="pug">
.wrap
  .speed-o-meter(v-if="launchableTargetSpeed")
    span.current {{ launchableSpeed.toFixed(2) }}
    span=" / "
    span.target {{ launchableTargetSpeed.toFixed(2) }}
    span  m/s
    .bar
      .inner
        .bg(:style="{ width: speedPercentage + '%', backgroundColor: speedColor }")
  //- .launchable-selector
  //-   b-select(v-model="selectedLaunchable")
  //-     option(v-for="(creature, key) in creatureList", :value="key") {{ creature.name }}
  .canvas(ref="canvas")
</template>
<script>
import Promise from 'bluebird'
import WebFont from 'webfontloader'
import _debounce from 'lodash/debounce'
import _throttle from 'lodash/throttle'
import _filter from 'lodash/filter'
import { tween, Tweenable } from 'shifty'
import { unit } from 'mathjs'
import { Loader, loadSprites } from '@/components/sprites'
import * as PIXI from 'pixi.js'
import { DropShadowFilter } from '@pixi/filter-drop-shadow'
import { GlowFilter } from '@pixi/filter-glow'
import { Viewport } from 'pixi-viewport'
import Creatures from '@/config/creatures.yaml'

PIXI.settings.PRECISION_FRAGMENT = 'mediump'

const svgResources = {
  'bee': require('@/assets/bee.svg')
}

const SCREEN_MARGIN = 200
const GLOBAL_IMAGE_SCALE = 1000

// function ignoreUselessErrors(error){
//   if ( error.message.match('Resource named') ){
//     return
//   }
//
//   return Promise.reject(error)
// }

function loadFonts(){
  return new Promise((resolve, reject) => {
    WebFont.load({
      google: {
        families: ['latin-modern-mono', 'Source Sans Pro']
      }
      , active(){
        resolve()
      }
      , inactive(){
        reject()
      }
    })
  })
}

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
  const pixelsToMeters = 2000 / maxWidth
  let unitWidth = maxWidth / 2
  let graphics = new PIXI.Graphics()
  let text = new PIXI.Text('0', {
    fontFamily: 'latin-modern-mono'
    , fontSize: 18
    , fill: 0xffffff
    , align: 'center'
  })
  text.resolution = window.devicePixelRatio
  text.anchor.set(0.5)
  graphics.addChild(text)

  function formatUnits( d ){
    let v = unit(d, 'm')
    let precision = Math.floor(d * 10) === 1 ? 1 : 0
    return v.format({ notation: 'fixed', precision })
  }

  function setScale( s ){
    s *= pixelsToMeters
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

const makeTrail = (function(){
  const width = 1000
  const canvas = document.createElement('canvas')
  canvas.height = 2
  canvas.width = width

  const ctx = canvas.getContext('2d')
  // trail
  // let trailWidth = 500 * cfg.speed
  let gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(1, '#ffffff')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, 2)
  const texture = PIXI.Texture.from(canvas.toDataURL())

  return trailWidth => {
    let trail = new PIXI.Sprite(texture)
    trail.scale.set(trailWidth/width, 1)
    trail.anchor.set(1, 0.5)

    return trail
  }
})()

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

  let s = scale * GLOBAL_IMAGE_SCALE / image.texture.width
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

function flickGestureImage(){
  let wrap = new PIXI.Graphics()
  let flick = new PIXI.Graphics()
  flick.beginFill(0xffffff, 1)
  flick.drawRect(0, 0, 20, 40)
  flick.drawRect(0, 40, 80, 70)
  flick.endFill()

  const distance = 50

  let move = new Tweenable()
  let moveConfig = {
    from: { x: 0 }
    , to: { x: distance }
    , duration: 500
    , easing: 'easeInOutQuad'
    , step({ x }){
      if (wrap._destroyed){ return }
      flick.position.x = x
    }
  }

  let moveBack = new Tweenable()
  let moveBackConfig = {
    from: { x: distance }
    , to: { x: 0 }
    , delay: 500
    , duration: 2000
    , easing: 'easeInOutQuad'
    , step({ x }){
      if (wrap._destroyed){ return }
      flick.position.x = x
    }
  }

  function animate(){
    if (wrap._destroyed){ return }
    move.tween(moveConfig).then(() => {
      if (wrap._destroyed){ return }
      moveBack.tween(moveBackConfig).then(animate)
    })
  }

  animate()

  wrap.addChild(flick)
  return wrap
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
    , creatureList: Creatures
    , launchableCreature: null
    , launchableSpeed: 0
  })
  , created(){
    this.time = 0

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
      .pinch({ center, noDrag: true })
      .wheel({ center, smooth: 20 })
      .clampZoom({
        minHeight: 100
        , maxHeight: 800000
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

    this.pulsateFilter = new GlowFilter(
      12 // distance
      , 5 // outerStrength
      , 1 // innerStrength
      , 0xcc0000 // color
      , 0.2 // quality
    )
    this.pulsateFilter.padding = 10

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

    this.labelLayer = new PIXI.Container()
    this.labelLayer.zIndex = 0
    this.stage.addChild(this.labelLayer)

    this.bubbleLayer = new PIXI.Container()
    this.bubbleLayer.zIndex = 11
    this.stage.addChild(this.bubbleLayer)

    this.entranceOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this.entranceOverlay.width = this.dimensions.width
    this.entranceOverlay.height = this.dimensions.height
    this.entranceOverlay.zIndex = 1000
    this.stage.addChild(this.entranceOverlay)

    this.launchersLayer = new PIXI.Container()
    this.launchersLayer.zIndex = 12
    this.stage.addChild(this.launchersLayer)

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
  , computed: {
    launchableTargetSpeed(){
      return this.launchableCreature && this.launchableCreature.speed
    }
    , speedPercentage(){
      return 100 * this.launchableSpeed / this.launchableTargetSpeed
    }
    , speedColor(){
      let c = 'rgba(0, 200, 0, 0.9)'
      let p = this.speedPercentage
      if ( p < 100 ){
        c = 'rgba(200, 200, 0, 0.9)'
      }
      if ( p < 80 ){
        c = 'rgba(200, 0, 0, 0.9)'
      }

      return c
    }
  }
  , mounted(){
    this.$refs.canvas.appendChild(this.app.view)
  }
  , methods: {
    async init(){
      await loadSprites()
      await loadFonts()

      this.flickGesture = flickGestureImage()

      this.creatures = []

      Creatures.forEach(c => {
        this.createFlyer({
          resource: c.image
          , x: this.viewport.left / 4
          , y: c.position.y
          , speed: c.speed
          , scale: Math.sqrt(c.size)
          , size: c.size
          , name: c.name
          , handleScale: 0.10
        })
      })

      this.initBg()
      this.initLengthScale()
      // this.initLaunchers()
      // this.initSpeedMeter()

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
        , duration: 500 //2000
        , easing: 'easeInOutQuad'
        , step: state => {
          this.entranceOverlay.alpha = state.opacity
        }
      })

      return tween({
        from: { zoom: 0.01 }
        , to: { zoom: 0.1 }
        , delay: 0 //1000
        , duration: 500 //4000
        , easing: 'easeInOutSine'
        , step: state => {
          this.zoom( state.zoom )
        }
      })
    }
    , initLengthScale(){
      let ls = lengthScale(0.5 * Math.min(810, this.dimensions.width, this.dimensions.height))
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
      let bg = new PIXI.Sprite(PIXI.Texture.WHITE)
      bg.width = 380
      bg.height = 120
      bg.alpha = 0.3
      this.launchersLayer.addChild(bg)

      let handles = Creatures.map(creature => {
        return this.createLaunchable({
          ...creature
          , resource: creature.image
          , scale: 0.10
          , x: 300
          , y: 60
        })
      })

      const selectHandle = index => {
        handles.forEach(h => (h.visible = false))
        handles[index].visible = true
      }

      this.$watch('selectedLaunchable', selectHandle)
      selectHandle(this.selectedLaunchable)
    }
    , initSpeedMeter(){
      const container = new PIXI.Graphics()
      const targetSpeed = new PIXI.Text('', {
        fontFamily: 'latin-modern-mono'
        , fontSize: 18
        , fill: 0xffffff
        , align: 'center'
      })

      const currentSpeed = new PIXI.Text('', {
        fontFamily: 'latin-modern-mono'
        , fontSize: 18
        , fill: 0xffffff
        , align: 'center'
      })

      currentSpeed.position.set(0, -20)

      container.addChild(targetSpeed)
      container.addChild(currentSpeed)

      container.position.set(24, this.dimensions.height - 40)
      this.$watch('dimensions', ({ height }) => {
        container.position.set(24, height - 40)
      })

      this.$watch('launchableSpeed', _throttle(speed => {
        currentSpeed.text = speed.toFixed(2) + ' m/s'
      }, 50), { immediate: true })

      this.$watch('launchableTargetSpeed', speed => {
        container.visible = !!speed
        if ( !speed ){ return }
        targetSpeed.text = speed.toFixed(2) + ' m/s'
      }, { immediate: true })

      container.zIndex = 20
      this.stage.addChild(container)
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
      const trackWidth = 800000
      let track = new PIXI.Graphics()
      track.interactive = true
      track.lineStyle(2, 0xffffff, 1)
      track.moveTo(0, 0)
      track.lineTo(trackWidth, 0)
      track.alpha = 0.05
      // track.beginFill(0xFF9933)
      // track.drawRoundedRect(0, 0, 20000, 2, 0)
      // track.endFill()
      track.x = -trackWidth/2
      track.y = 0
      track.zIndex = -1
      track.hitArea = new PIXI.Rectangle(0, -20, trackWidth, 40)
      track.cursor = 'grab'

      this.trackLayer.addChild(track)

      // trail
      const trail = makeTrail(500 * cfg.speed)
      trail.name = 'trail'
      trail.position.x = -image.width / 2
      movingGraphic.addChild(trail)

      const trailClone = makeTrail(500 * cfg.speed)
      trailClone.name = 'trailClone'
      trailClone.position.set(viewport.worldWidth, 0)
      movingGraphic.addChild(trailClone)

      let title = new PIXI.Text(cfg.name, {
        fontFamily: 'latin-modern-mono'
        , fontSize: 14
        , fill: 0xffffff
        , align: 'center'
      })
      title.alpha = 0.9
      title.resolution = window.devicePixelRatio
      // title.scale.set(cfg.scale)
      title.anchor.set(0.5, 1)
      // title.position.set(-(1.3) * image.width / 2, 0)
      this.labelLayer.addChild(title)

      this.$watch('dimensions', () => {
        title.position.x = this.dimensions.width / 2
      })

      let oldViewportRight = viewport.right
      const fixScale = scale => {
        scale = scale || viewport.scaled
        // unzoom the track
        const s = 1 / scale
        track.scale.set(track.scale.x, s)
        trail.scale.set(trail.scale.x, s)
        trailClone.scale.set(trailClone.scale.x, s)
        title.position.set(this.dimensions.width / 2, viewport.toScreen(movingGraphic.position).y)
        // motionBlur.velocity.x = cfg.speed * scale * 2

        // account for zoom out that causes trail clone edges to be visible
        // instead push them to the right of the screen
        if ( viewport.right > oldViewportRight ){
          trailClone.position.x += viewport.right - oldViewportRight
        }
        oldViewportRight = viewport.right
      }
      this.$on('zoom', fixScale)

      let offscreenIndicator = makeOffscreenThumb(cfg.resource)
      offscreenIndicator.position.set(100, 40)
      offscreenIndicator.zIndex = 10
      offscreenIndicator.buttonMode = true
      offscreenIndicator.interactive = true
      this.bubbleLayer.addChild(offscreenIndicator)

      function setYPosition( y ){
        movingGraphic.position.y = y
        track.position.y = y
        title.position.y = viewport.toScreen(movingGraphic.position).y
      }

      function setXPosition( x ){
        movingGraphic.position.x = x
        offscreenIndicator.position.x = viewport.toScreen(x, 0).x
      }

      function show(){
        movingGraphic.visible = true
        track.visible = true
        title.visible = true
        offscreenIndicator.visible = true
        handleZoom()
      }

      function hide( fadeTime = 0 ){
        if ( !fadeTime ){
          movingGraphic.visible = false
          track.visible = false
          title.visible = false
          offscreenIndicator.visible = false
          return Promise.resolve()
        }

        return tween({
          from: { alpha: 1 }
          , to: { alpha: 0 }
          , delay: 0
          , duration: fadeTime
          , easing: 'easeOutQuad'
          , step: state => {
            let { alpha } = state
            movingGraphic.alpha = alpha
            track.alpha = alpha
            title.alpha = alpha
            offscreenIndicator.alpha = alpha
          }
        }).then(() => {
          hide(0)
          movingGraphic.alpha = 1
          track.alpha = 1
          title.alpha = 1
          offscreenIndicator.alpha = 1
        })
      }

      const destroy = ( fadeTime = 0 ) => {
        if ( fadeTime ){
          return hide(fadeTime).then(() => destroy())
        }

        let idx = this.creatures.indexOf(creature)
        if ( idx > -1 ){
          this.creatures.splice(idx, 1)
        }

        this.bubbleLayer.removeChild(offscreenIndicator)
        this.trackLayer.removeChild(track)
        this.labelLayer.removeChild(title)
        this.creaturesLayer.removeChild(movingGraphic)
      }

      function moveWrap(dt){
        let obj = movingGraphic
        let v = this.speed
        let hw = 0.5 * image.width
        let { x } = obj.position
        let margin = SCREEN_MARGIN / viewport.scaled

        x += v * dt * GLOBAL_IMAGE_SCALE / 100

        if ( v > 0 ){
          if ( (x - hw - margin) > viewport.right ){
            let diff = x
            x = viewport.left - hw
            diff -= x
            trailClone.visible = true
            trailClone.position.x = (diff + trail.position.x) / movingGraphic.scale.x
          }

          if ( (x + hw + margin) < viewport.left ){
            x = viewport.left - hw
          }
        }

        // if ( v < 0 ){
        //   if ( (x + hw + margin) < viewport.left ){
        //     let diff = x
        //     x = viewport.right + hw
        //     diff -= x
        //     trailClone.position.x = diff + trail.position.x
        //   }
        //
        //   if ( (x - hw - margin) > viewport.right ){
        //     x = viewport.left - hw
        //   }
        // }

        setXPosition(x)
      }

      const creature = {
        name: cfg.name
        , movingGraphic
        , track
        , speed: cfg.speed
        , paused: false
        , setXPosition
        , setYPosition
        , moveWrap
        , show
        , hide
        , destroy
      }

      // Grab interactions
      const handlePos = new PIXI.Point(100, 100)
      const handle = new PIXI.Graphics()
      handle.interactive = true
      handle.cursor = 'grab'
      handle.position.copyFrom(handlePos)
      handle.visible = false
      const handleImage = resourceToGraphics(cfg.resource, cfg.handleScale)
      handleImage.filters = [this.pulsateFilter]
      handle.addChild(handleImage)
      const handleText = new PIXI.Text(cfg.name, {
        fontFamily: 'latin-modern-mono'
        , fontSize: 14
        , fill: 0xffffff
        , align: 'center'
      })
      handleText.position.y = handleImage.height/2 + 12
      handleText.alpha = 0.9
      handleText.resolution = window.devicePixelRatio
      handleText.anchor.set(0.5, 0)
      handle.addChild(handleText)

      const minTimeDelay = 5
      const minThrowSpeed = 1
      let screenPos
      let lastPos
      let lastTime = 0
      let speed

      const setDead = () => {
        this.flickGesture.position.set(100, 100)
        handle.addChild(this.flickGesture)

        handle.position.y = viewport.toScreen(track.position).y
        handle.visible = true
        this.deadCreature = creature
        creature.isDead = true
        creature.movingGraphic.scale.set(1, 1)
        trail.alpha = 1
        movingGraphic.zIndex = Math.floor(1 / cfg.scale)
        trailClone.visible = true
        trailClone.alpha = 1

        fixScale()
        hide()
      }

      const grab = e => {
        if ( (this.deadCreature && this.deadCreature !== creature) || creature.grabbing ){ return }
        if ( e ){
          if ( e.data.originalEvent.button ){ return }
          e.stopPropagation()
          handle.data = e.data

          screenPos = handle.data.getLocalPosition(handle.parent)
          lastPos = viewport.toWorld(screenPos)

          creature.setXPosition(lastPos.x)
          creature.setYPosition(lastPos.y)
        }

        clearTimeout(this.flyTimeout)
        this.launchableCreature = cfg
        this.setLaunchableSpeed(0)
        trail.cursor = 'grabbing'
        handle.visible = false
        creature.paused = true
        creature.grabbing = true
        creature.isDead = false
        show()
        fixScale()
        trailClone.visible = false

        let zoom = cfg.handleScale / Math.sqrt(cfg.size)
        this.animateZoomTo(zoom, 200, () => {
          if ( !creature.grabbing ){ return }
          let pos = viewport.toWorld(screenPos)
          creature.setXPosition(pos.x)
          creature.setYPosition(pos.y)
        })
      }

      const move = (screenPos) => {
        if ( !creature.grabbing ){ return }
        screenPos = handle.data.getLocalPosition(handle.parent)
        const pos = viewport.toWorld(screenPos)
        creature.setXPosition(pos.x)
        creature.setYPosition(pos.y)

        const time = performance.now()
        let dt = Math.max(time - lastTime, minTimeDelay)

        speed = Math.max((pos.x - lastPos.x) / dt, 0)
        this.setLaunchableSpeed(speed)

        lastPos = pos
        lastTime = time
      }

      const fly = (creature, speed) => {
        this.deadCreature = null

        this.flyTimeout = setTimeout(() => {
          this.launchableCreature = null
        }, 4000)

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
        this.deadCreature = creature
        movingGraphic.zIndex = 0
        track.visible = false
        const startScale = trail.scale.clone()
        let tcx = trailClone.position.x = 1e12
        tween({
          from: { speed, scale: movingGraphic.scale.x, alpha: 1 }
          , to: { speed: 0, scale: 1e-9, alpha: 0 }
          , delay: 0
          , duration: 3000
          , easing: 'easeOutQuad'
          , step: state => {
            let { scale, alpha, speed } = state
            let s = 1/scale
            creature.speed = speed
            tcx = trailClone.position.x * movingGraphic.scale.x
            movingGraphic.scale.set(scale, scale)
            trail.scale.set(startScale.x * s, startScale.y * s)
            trailClone.scale.set(startScale.x * s, startScale.y * s)
            trail.alpha = alpha
            trailClone.alpha = alpha
            trailClone.position.x = tcx * s
          }
        }).then(() => {
          trail.scale.copyFrom(startScale)
          trailClone.scale.copyFrom(startScale)
          setDead()
        })
      }

      const release = () => {
        if ( !creature.grabbing ){ return }

        const time = performance.now()
        let dt = time - lastTime
        if ( dt > 2 ){
          dt = Math.max(dt, minTimeDelay)
          screenPos = handle.data.getLocalPosition(handle.parent)
          const pos = viewport.toWorld(screenPos)
          speed = Math.max((pos.x - lastPos.x) / dt, 0)
          this.setLaunchableSpeed(speed)
        }

        handle.data = null
        handle.cursor = 'grab'
        creature.paused = false
        creature.grabbing = false

        if ( speed < minThrowSpeed ){
          setDead()
        } else if ( speed >= cfg.speed ){
          fly(creature, speed)
        } else {
          fall(creature)
        }
      }

      track
        .on('pointerdown', grab)
        .on('pointermove', move)
        .on('pointerup', release)
        .on('pointerupoutside', release)

      handle.on('pointerdown', grab)

      this.launchersLayer.addChild(handle)

      // export
      creature.grab = grab
      creature.move = move
      creature.fall = fall
      creature.fly = fly
      creature.release = release

      const handleZoom = () => {
        if ( creature.isDead ){ return }
        let y = movingGraphic.position.y
        let margin = movingGraphic.height * 0.6
        let isAbove = (y + margin) < viewport.top
        let isBelow = (y - margin) > viewport.bottom
        let isOffscreen = isAbove || isBelow

        if ( isOffscreen !== offscreenIndicator.visible ){
          creature.paused = creature.grabbing ? true : false
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
      fixScale(viewport.scaled)
      handleZoom()
      this.creatures.push(creature)
      return creature
    }
    , createLaunchable( cfg = {} ){
      const viewport = this.viewport
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

        // hide other instances

        _filter(this.creatures, { name: cfg.name }).forEach(c => {
          if ( c === creature ){ return }
          c.destroy(1000)
        })
      }

      const move = () => {
        if ( !handle.dragging ){ return }
        screenPos = handle.data.getLocalPosition(handle.parent)
        const pos = viewport.toWorld(screenPos)
        creature.setXPosition(pos.x)
        creature.setYPosition(pos.y)

        const time = performance.now()
        let dt = Math.max(time - lastTime, 10)

        speed = Math.max((pos.x - lastPos.x) / dt, 0)
        this.launchableSpeed = speed

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
        creature.track.visible = false
        creature.movingGraphic.getChildByName('trailClone').visible = false
        const trail = creature.movingGraphic.getChildByName('trail')
        const startScale = trail.scale.clone()
        tween({
          from: { speed, scale: creature.movingGraphic.scale.x, alpha: 1 }
          , to: { speed: 0, scale: 1e-9, alpha: 0 }
          , delay: 0
          , duration: 3000
          , easing: 'easeOutQuad'
          , step: state => {
            let { scale, alpha, speed } = state
            let s = 1/scale
            creature.speed = speed
            creature.movingGraphic.scale.set(scale, scale)
            trail.scale.set(startScale.x * s, startScale.y * s)
            trail.alpha = alpha
          }
        }).then(() => {
          trail.visible = false
          creature.destroy(500)
        })
      }

      const release = () => {
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
      return handle
    }
    , draw(dt){
      this.time += dt
      this.pulsateFilter.outerStrength = 1 + Math.sin(this.time / 10)
      if ( this.paused ){ return }
      this.animateFlyers(dt)
    }
    , animateFlyers(dt){
      for (let i = 0, l = this.creatures.length; i < l; i++){
        let creature = this.creatures[i]
        if ( !creature.paused ){
          creature.moveWrap(dt)
        }
      }
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
    , setLaunchableSpeed: _throttle(function(s){
      this.launchableSpeed = s
    }, 50)
  }
}
</script>

<style lang="sass" scoped>
.wrap
  position: relative
  height: 100vh
.launchable-selector
  position: absolute
  top: 2.5em
  left: 1em
  z-index: 2
.speed-o-meter
  position: absolute
  bottom: 30px
  left: 0px
  padding: 0 30px
  width: 50vw
  max-width: 400px
  z-index: 100
  font-family: $family-monospace
  font-size: 20px

  .bar
    height: 20px
    width: 100%
    border: 1px solid rgba(255, 255, 255, 0.5)
    border-radius: 2px
    overflow: hidden
    position: relative
    .inner
      height: 100%
      width: 80%
      border-right: 1px solid rgba(0, 200, 0, 0.8)
    .bg
      transition: width .15s linear
      height: 100%
      background: white
</style>
