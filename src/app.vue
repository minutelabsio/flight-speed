<template lang="pug">
#app
  router-view
</template>

<script>
// import PubSub from '@/lib/pubsub'

export default {
  name: 'App'
  , data: () => ({
  })
  , created(){
    document.documentElement.addEventListener('scroll', e => {
      console.log('test')
      e.preventDefault()
    })
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
</style>
