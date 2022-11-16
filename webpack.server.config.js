const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const { compilerOptions } = require('./tsconfig.json');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const envPlugin = new webpack.EnvironmentPlugin({
  NODE_ENV: '',
  WEB3_HTTP_PROVIDER: '',
  ENS_RESOLVER: '',
  ARB_HTTP_PROVIDER: '',
  ARB_REGISTRAR: '',
  ARB_PRIVATE_KEY: '',
  ARB_ADDRESS: '',
  DB_DIALECT: '',
  DB_STORAGE: '',
  DB_NAME: '',
  DB_USERNAME: '',
  DB_PASSWORD: '',
  DB_HOST: '',
  DB_PORT: '',
  PORT: '',
  GUN_PORT: '',
  GUN_PEERS: '',
  INTERREP_API: '',
  INTERREP_CONTRACT: '',
  JWT_SECRET: '',
  TW_CALLBACK_URL: '',
  TW_CONSUMER_KEY: '',
  TW_CONSUMER_SECRET: '',
  TW_BEARER_TOKEN: '',
  TW_ACCESS_KEY: '',
  TW_ACCESS_SECRET: '',
});

const rules = [
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|.webpack)/,
    rules: [
      {
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
];

module.exports = [
  {
    mode: isProd ? 'production' : 'development',
    entry: [`./src/index.ts`],
    target: 'node',
    devtool: 'source-map',
    externals: [nodeExternals()],
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.png', '.svg'],
      modules: [path.resolve('./node_modules'), path.resolve(__dirname, compilerOptions.baseUrl)],
      alias: {
        '@models': 'src/models',
        '@services': 'src/services',
        '@util': 'src/util',
        '~': 'lib',
        '#': 'static',
      },
    },
    module: {
      rules: [...rules],
    },
    output: {
      path: __dirname + '/build',
      filename: `server.js`,
    },
    plugins: [envPlugin],
  },
];
