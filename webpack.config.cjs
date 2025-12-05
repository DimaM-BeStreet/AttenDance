const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
  mode: 'development',
  entry: {
    app: './src/app.js',
    login: './src/pages/login.js',
    'forgot-password': './src/pages/forgot-password.js',
    'manager/dashboard': './src/pages/manager/dashboard.js',
    'manager/students': './src/pages/manager/students.js',
    'manager/teachers': './src/pages/manager/teachers.js',
    'manager/templates': './src/pages/manager/templates.js',
    'manager/locations': './src/pages/manager/locations.js',
    'manager/locations-styles': './src/pages/manager/locations-styles.js',
    'manager/branches': './src/pages/manager/branches.js',
    'manager/branches-styles': './src/pages/manager/branches-styles.js',
    'manager/courses': './src/pages/manager/courses.js',
    'manager/classes': './src/pages/manager/classes.js',
    'manager/attendance': './src/pages/manager/attendance.js',
    'manager/users': './src/pages/manager/users.js',
    'manager/users-styles': './src/pages/manager/users-styles.js',
    'manager/settings': './src/pages/manager/settings.js',
    'manager/reports': './src/pages/manager/reports.js',
    'teacher/auth': './src/pages/teacher/auth.js',
    'teacher/attendance': './src/pages/teacher/attendance.js'
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
    new Dotenv({
      systemvars: true, // Load system environment variables as well
      safe: false // Don't fail if .env is missing (for CI/CD)
    }),
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
