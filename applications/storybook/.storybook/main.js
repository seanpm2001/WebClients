const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const getAlias = require('proton-pack/webpack/alias');
const { getJsLoader } = require('proton-pack/webpack/js.loader');
const getCssLoaders = require('proton-pack/webpack/css.loader');
const getAssetsLoaders = require('proton-pack/webpack/assets.loader');

module.exports = {
    webpackFinal: async (config, { configType }) => {
        const isProduction = configType === 'PRODUCTION';

        const options = {
            isProduction,
            hasReactRefresh: false,
        };

        return {
            ...config,
            resolve: {
                ...config.resolve,
                alias: {
                    ...config.resolve.alias,
                    ...getAlias(),
                },
            },
            module: {
                ...config.module,
                rules: [
                    ...config.module.rules.filter((rule) => {
                        return rule.test.toString().includes('mdx');
                    }),
                    {
                        test: /\.stories\.(tsx|mdx)?$/,
                        loaders: [
                            {
                                loader: require.resolve('@storybook/source-loader'),
                                options: { parser: 'typescript' },
                            },
                        ],
                        enforce: 'pre',
                    },
                    ...[getJsLoader(options), ...getCssLoaders(options), ...getAssetsLoaders(options)],
                ],
            },
            plugins: [
                ...config.plugins,
                new MiniCssExtractPlugin({
                    filename: isProduction ? '[name].[contenthash:8].css' : '[name].css',
                    chunkFilename: isProduction ? '[id].[contenthash:8].css' : '[id].css',
                }),
            ],
        };
    },
    stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: ['@storybook/addon-links', '@storybook/addon-storysource', '@storybook/addon-essentials'],
    typescript: {
        check: false,
        checkOptions: {},
        reactDocgen: 'react-docgen-typescript',
        reactDocgenTypescriptOptions: {
            shouldRemoveUndefinedFromOptional: true,
        },
    },
};
