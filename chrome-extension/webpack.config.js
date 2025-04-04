const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    'aws-sdk-bundle': './aws/aws-sdk-bundle.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'lib'),
    library: 'awsSdk',
    libraryTarget: 'var'
  },
  resolve: {
    fallback: {
      "util": false,
      "url": false,
      "path": false,
      "fs": false,
      "stream": false,
      "http": false,
      "https": false,
      "zlib": false,
      "assert": false
    }
  }
};
