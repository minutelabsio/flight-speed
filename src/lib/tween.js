import TWEEN from 'tween.js'

function animate(time) {
  requestAnimationFrame(animate)
  TWEEN.update(time)
}

requestAnimationFrame(animate)

const easings = {
  'easeInQuad': TWEEN.Easing.Quadratic.In
  , 'easeOutQuad': TWEEN.Easing.Quadratic.Out
  , 'easeInOutQuad': TWEEN.Easing.Quadratic.InOut
  , 'easeInOutSine': TWEEN.Easing.Sinusoidal.InOut
}

export function tween({ from, to, delay, duration, step, easing }){
  return new Promise((resolve, reject) => {
    let state = from
    try {
      new TWEEN.Tween(state)
        .to(to, duration)
        .delay(delay)
        .easing(easings[easing])
        .onUpdate(() => step(state))
        .onComplete(resolve)
        .start()
    } catch ( e ) {
      reject(e)
    }
  })
}
