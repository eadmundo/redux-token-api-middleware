var path = require('path');
var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var Clean = require('clean-webpack-plugin');

module.exports = {
  devtool: 'cheap-module-eval-source-map',
  devServer: {
    port: process.env.BASIC_LOGIN_EXAMPLE_PORT || 3030,
    contentBase: path.resolve(__dirname, 'dist')
  },
  entry: path.resolve(__dirname, 'src/main.js'),
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'bundle.js'
  },
  plugins: [
    new webpack.optimize.OccurenceOrderPlugin()
    new webpack.NoErrorsPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development')
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(__dirname, '../templates/index.html'),
      inject: 'body'
    }),
    new Clean(['build'])
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /node_modules/,
        include: __dirname,
        query: {
          presets: ['es2015', 'stage-0', 'react']
        }
      },
      {
        test: /\.json$/i,
        loader: 'json-loader'
      }
    ]
  }
}

// When inside repo, prefer src to compiled version.
var reduxApiTokenMiddlewareSrc = path.join(__dirname, '..', '..', 'src')
var repoNodeModules = path.join(__dirname, '..', '..', 'node_modules')
var fs = require('fs')
if (fs.existsSync(reduxApiTokenMiddlewareSrc) && fs.existsSync(repoNodeModules)) {
  // Resolve middleware to source
  module.exports.resolve = { alias: { 'redux-api-token-middleware': reduxApiTokenMiddlewareSrc } }
  // Compile middleware from source
  module.exports.module.loaders.push({
    test: /\.js$/,
    loaders: [ 'babel' ],
    include: reduxApiTokenMiddlewareSrc
  })
}
