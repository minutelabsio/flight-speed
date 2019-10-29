<template lang="pug">
.about
  .inner.scrollbars
    .container
      .section
        .content
          p
            router-link(:to="{ name: 'home' }")
              b-icon(icon="chevron-left")
              span Back to the Lab
          h2.title.has-text-centered What's this all about?
          p.
            Well blah blah blah
</template>

<style lang="sass" scoped>
a
  color: $text
  text-decoration: underline
  .icon
    vertical-align: middle
    padding-bottom: 4px
.about
  font-size: 18px
  height: 100%
  overflow: auto

.inner
  min-height: 100%
  background-color: rgba(0, 0, 0, 0.5)

</style>
