const paths = require('react-scripts/config/paths');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require("webpack");
module.exports = {
     webpack: override,
};
// Function to override the CRA webpack config
function override(config, env) {
    const fallback = config.resolve.fallback || {};
    config.resolve.fallback = {
        process: require.resolve('process/browser'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
    };
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        })
    ]);
    // Remove the default HtmlWebpackPlugin
    config.entry = {
        index: paths.appIndexJs,
        background: paths.appSrc + '/background',
        content: paths.appSrc + '/content'
    };
    // Change output filename template to get rid of hash there
    config.output.filename = 'static/js/[name].js';
    // Disable built-in SplitChunksPlugin
    config.optimization.splitChunks = {
        cacheGroups: {default: false}
    };
    // Disable runtime chunk addition for each entry point
    config.optimization.runtimeChunk = false; 
    // Shared minify options
    const minifyOpts = {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: false,
        minifyCSS: false,
        minifyURLs: false,
    };
    const isEnvProduction = env === 'production';
    // Custom HtmlWebpackPlugin instance for index page
    const indexHtmlPlugin = new HtmlWebpackPlugin({
        inject: true,
        chunks: ['index'],
        template: paths.appHtml,
        filename: 'index.html',
        minify: isEnvProduction && minifyOpts,
    });
    // Replace original HtmlWebpackPlugin instance in config.plugins with the above one
    config.plugins = replacePlugin(config.plugins,
        (name) => /HtmlWebpackPlugin/i.test(name), indexHtmlPlugin
    );
    // Custom ManifestPlugin instance to cast asset-manifest.json back to old plain format
    const manifestPlugin = new (ManifestPlugin.WebpackManifestPlugin      || ManifestPlugin)({
            fileName: 'asset-manifest.json',
    });
    // Replace original ManifestPlugin instance in config.plugins with the above one
    config.plugins = replacePlugin(config.plugins,
        (name) => /ManifestPlugin/i.test(name), manifestPlugin
    );
    // Custom MiniCssExtractPlugin instance to get rid of hash in filename template
    const miniCssExtractPlugin = new MiniCssExtractPlugin({
        filename: 'static/css/[name].css'
    });
    // Replace original MiniCssExtractPlugin instance in config.plugins with the above one
    config.plugins = replacePlugin(config.plugins,
        (name) => /MiniCssExtractPlugin/i.test(name), miniCssExtractPlugin
    );
    // Remove GenerateSW plugin from config.plugins to disable service worker generation
    config.plugins = replacePlugin(config.plugins,
        (name) => /GenerateSW/i.test(name)
    );
    return config;
}
// Utility function to replace/remove specific plugin in a webpack config
function replacePlugin(plugins, nameMatcher, newPlugin) {
    const i = plugins.findIndex((plugin) => {
        return plugin.constructor && plugin.constructor.name &&
            nameMatcher(plugin.constructor.name);
    });
    return i > -1?
        plugins.slice(0, i).concat(newPlugin ||[]).concat(plugins.slice(i+1)) :
        plugins;
}
