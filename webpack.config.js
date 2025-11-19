const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    app: './src/app.js'
    // Additional entry points will be added as pages are created
  },
  output: {
    filename: 'js/[name].bundle.js',
    path: path.resolve(__dirname, 'public'),
    clean: false
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/assets', to: 'assets', noErrorOnMissing: true }
      ]
    })
  ],
  resolve: {
    extensions: ['.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@config': path.resolve(__dirname, 'src/config')
    }
  },
  devtool: 'source-map'
};
