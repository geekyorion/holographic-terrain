const webpackMerge = require('webpack-merge');
const commonConfiguration = require('./webpack.common.js');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = webpackMerge.merge(
    commonConfiguration, {
        mode: 'production',
        plugins: [
            new CleanWebpackPlugin()
        ]
    }
);
