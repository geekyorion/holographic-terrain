const webpackMerge = require('webpack-merge');
const commonConfiguration = require('./webpack.common.js');

module.exports = webpackMerge.merge(
    commonConfiguration, {
        mode: 'development',
        devServer: {
            open: true,
            https: false,
            liveReload: true
        }
    }
);
