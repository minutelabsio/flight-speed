const path = require('path')
const labConfig = require('./lab-config')

process.env.VUE_APP_LAB_NAME = labConfig.title

module.exports = {
  publicPath: process.env.NODE_ENV === 'production'
    ? `/${labConfig.repo}/`
    : '/'
  , configureWebpack: {
    resolve: { symlinks: false }
    , node: {
      __dirname: true
    }
    , plugins: [

  	]
    , output: {
      globalObject: 'this'
    }
    , module: {
      // rules: [
      //   {
      //     test: /\.js$/
      //     , use: [
      //       'comlink-loader'
      //     ]
      //     , include: [ path.resolve(__dirname, 'src/workers') ]
      //   }
      // ]
    }
  }
  , css: {
    loaderOptions: {
      // pass options to sass-loader
      sass: {
        data: `@import '@/styles/_variables.scss'`
      }
    }
  }
}
