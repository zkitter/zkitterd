const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

const isProd = process.env.NODE_ENV === 'production';

const envPlugin = new webpack.EnvironmentPlugin([
    'NODE_ENV',
    'WEB3_HTTP_PROVIDER',
]);

const rules = [
    {
        test: /\.node$/,
        use: 'node-loader',
    },
    {
        test: /\.tsx?$/,
        exclude: /(node_modules|.webpack)/,
        loaders: [{
            loader: 'ts-loader',
            options: {
                transpileOnly: true,
            },
        }],
    },
];

module.exports = [
    {
        mode: isProd ? 'production' : 'development',
        entry: [
            `./src/index.ts`,
        ],
        target: "node",
        devtool: 'source-map',
        externals: [nodeExternals()],
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.png', '.svg'],
        },
        module: {
            rules: [
                ...rules,
            ],
        },
        output: {
            path: __dirname + '/build',
            filename: `server.js`,
        },
        plugins: [
            envPlugin,
        ],
    },
];