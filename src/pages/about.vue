<template lang="pug">
.about
  .inner.scrollbars
    .container
      .section
        .content
          .level
            .level-left
              router-link(:to="{ name: 'home' }")
                b-icon(icon="chevron-left")
                span Back to the Lab
            .level-right
              a(href="https://minutelabs.io", target="_blank")
                span See more Labs!
                b-icon(icon="launch", size="is-small")

          .logo
            figure.image.is-128x128
              img.is-rounded.has-background-white(src="//cdn.minutelabs.io/logos/logo-minutelabs-no-text.png")
          h1.title.has-text-centered Flight Speed
          p.
            The idea for this lab was cooked up while the Minute Earth team
            was making the video on
            <a href="https://www.youtube.com/watch?v=3n1DC_Q-2Ng" target="_blank">The Best Dragon (According to Science)</a>.
            Julián was ranking different dragons by how realistic they were, in part,
            based on their flight speed compared to their size.

          p.
            This lab shows a comparison of different flying things. They all fly
            at their minimum flight speed, and are scaled by their actual size.

          h4.title What can this lab do?

          p.
            You can zoom in and out (pinch, or scroll) to see different flying things.
            You can move your view (drag background, or two finger drag).
            You can drag the creatures up and down to move their flight paths.
            You can drag the creatures sideways to launch them!

          p.
            When launching the creatures, you need to get them above their minimum
            flight speed, otherwise they fall...

          h4.title A minimum speed for flight...
          p.
            Anything with wings (or perhaps even without), has a minimum speed
            it needs to maintain to stay airborn. If it goes too slow, it will
            fall out of the sky. This minimum speed depends roughly on two things:
            how large its wings are, and how heavy it is. The larger its wings
            the more lift it gets, so the slower it can fly. But the heavier
            it is, the more lift it needs to overcome the force of gravity.
            The balance between the upward lift of the wings and the downward
            force of gravity will determine the minimum flight speed.

          p.
            A creature could go faster, but the faster it goes, the more air
            resistance it will feel, and the less energy efficient its flying
            will be.

          p.
            Turns out most creatures fly very close to this "ideal" flight speed.
            Not too fast to be inefficient, but not too slow to... well... fall.

          h3.title.is-size-4 Credits
          p.
            This project was developed by Jasper Palfree.
          p.
            Artwork and design elements by Sarah Berman.
          p.
            Concept and research by Julián Gómez and Henry Reich.
          p.
            And this wouldn't have been built without the support of the whole
            MinuteEarth team.

          h3.title.is-size-4 Thank you, Patreon Supporters! (so much)
          p.
            Geeks like you are the reason I build things.

          <a href="https://www.patreon.com/bePatron?u=617966" target="_blank">
            <img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="217" height="51">
          </a>

          h3.title.is-size-4 Source Code
          p.
            As always, freely available on
            <a :href="'https://github.com/minutelabsio/' + $labConfig.repo" target="_blank">github</a>.

          h3.title.is-size-4 Bug Reports
          p.
            If you find a bug, you can post it on
            <a href="https://www.patreon.com/minutelabsio" target="_blank">patreon</a>,
            <a href="mailto:bugs@minutelabs.io">email us</a>,
            or post it on <a :href="'https://github.com/minutelabsio/' + $labConfig.repo" target="_blank">github</a>.


</template>

<style lang="sass" scoped>
a
  color: $text
  text-decoration: underline
  .icon
    vertical-align: middle
    padding-bottom: 4px
.about
  position: relative
  z-index: 1
  font-family: $family-sans-serif
  font-size: 18px
  height: 100%
  overflow: auto
  background-color: rgba(0, 0, 0, 0.5)

.inner
  min-height: 100%
  max-width: 1080px
  margin: auto
.logo .image
  margin: auto
</style>
