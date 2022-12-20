const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';

const envPlugin = new webpack.EnvironmentPlugin([
  'NODE_ENV',
  'WEB3_HTTP_PROVIDER',
  'ENS_RESOLVER',
  'ARB_HTTP_PROVIDER',
  'ARB_REGISTRAR',
  'ARB_PRIVATE_KEY',
  'ARB_ADDRESS',
  'DB_DIALECT',
  'DB_STORAGE',
  'DB_NAME',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_PORT',
  'PORT',
  'GUN_PORT',
  'GUN_PEERS',
  'INTERREP_API',
  'INTERREP_CONTRACT',
  'JWT_SECRET',
  'TW_CALLBACK_URL',
  'TW_CONSUMER_KEY',
  'TW_CONSUMER_SECRET',
  'TW_BEARER_TOKEN',
  'TW_ACCESS_KEY',
  'TW_ACCESS_SECRET',
]);

const rules = [
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|.webpack)/,
    loaders: [
      {
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
];

function getEntries(dirpath, list = []) {
  const filenames = fs.readdirSync(dirpath);
  for (let filename of filenames) {
    const itempath = dirpath + '/' + filename;
    const isDirectory = fs.lstatSync(itempath).isDirectory();

    if (isDirectory) {
      getEntries(itempath, list);
    } else {
      if (filename.match(/.*\.test\.ts$/)) {
        list.push(itempath);
      }
    }
  }
  return list;
}

module.exports = [
  {
    mode: isProd ? 'production' : 'development',
    entry: getEntries('./src'),
    target: 'node',
    devtool: 'source-map',
    externals: [nodeExternals()],
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.png', '.svg'],
    },
    module: {
      rules: [...rules],
    },
    output: {
      path: __dirname + '/build-test',
      filename: `test.js`,
    },
    plugins: [envPlugin],
  },
];
