var webpack = require('webpack');

module.exports = {
  // entry: provided by serverless
  // output: provided by serverless
  target: 'node',
  externals: [
    'aws-sdk',
  ],
  resolve: {
    extensions: ['', '.js', '.jsx'],
  },
  devtool: 'source-map',
  plugins: [
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        unused: true,
        dead_code: true,
        warnings: false,
        drop_debugger: true,
      },
    }),
    new webpack.BannerPlugin(
      'require("source-map-support").install(); require("babel-polyfill");',
      { raw: true, entryOnly: false }
    ),
  ],
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'babel',
        exclude: /node_modules/,
        query: {
          presets: ['es2015', 'stage-0'],
        },
      },
    ],
  },
};
