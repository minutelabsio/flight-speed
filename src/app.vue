<template lang="pug">
#app
  .sky
  router-view
</template>

<script>
// import PubSub from '@/lib/pubsub'

export default {
  name: 'App'
  , data: () => ({
  })
  , created(){
  }
}
</script>

<style lang="sass" scoped>
#app
  position: fixed
  top: 0
  left: 0
  right: 0
  bottom: 0
  background: url('./assets/ML 12 - Ground.jpg')
  background-size: 80% 80%

  .sky
    position: absolute
    top: 0
    left: 0
    right: 0
    bottom: 0
    z-index: 0
    background: rgba(0, 0, 20, 0.6) url('./assets/ML 12 - Sky.png')
    background-size: 80% 80%
    opacity: 0.6
</style>
