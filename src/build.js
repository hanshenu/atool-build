import { join, resolve } from 'path';
import fs from 'fs-extra';
import webpack, { ProgressPlugin } from 'webpack';
import chalk from 'chalk';
import mergeCustomConfig from './mergeCustomConfig';
import getWebpackCommonConfig from './getWebpackCommonConfig';
import MpaasLibReferencePlugin from './MpaasLibReferencePlugin';
import deasync from 'deasync';

function addMpaasCommonRefs(args, webpackConfig) {
    var common_path = join(args.cwd, './libs/mpaas_common/');
    if (fs.existsSync(common_path)) {
        var files = fs.readdirSync(common_path);
        files.forEach(function(file) {
            var stats = fs.statSync(common_path + '/' + file);
            if (stats.isFile() && file.indexOf("manifest.json", file.length - "manifest.json".length) !== -1) {
                webpackConfig.plugins = [...webpackConfig.plugins,
                    new MpaasLibReferencePlugin({
                        context: args.cwd,
                        manifestname: join(common_path, file),
                    })
                ]
            }
        });
    }
}

function addOtherPlugins(args, webpackConfig) {
    // Config if no --no-compress.
    if (args.compress) {
        webpackConfig.UglifyJsPluginConfig = {
            output: {
                ascii_only: true,
            },
            compress: {
                warnings: false,
            },
        };
        webpackConfig.plugins = [...webpackConfig.plugins,
            new webpack.optimize.UglifyJsPlugin(webpackConfig.UglifyJsPluginConfig),
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
            }),
        ];
    } else {
        if (process.env.NODE_ENV) {
            webpackConfig.plugins = [...webpackConfig.plugins,
                new webpack.DefinePlugin({
                    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
                }),
            ];
        }
    }

    webpackConfig.plugins = [...webpackConfig.plugins,
        new webpack.optimize.DedupePlugin(),
        new webpack.NoErrorsPlugin(),
    ];

    // Output map.json if hash.
    if (args.hash) {
        const pkg = require(join(args.cwd, 'package.json'));
        webpackConfig.output.filename = webpackConfig.output.chunkFilename = '[name]-[chunkhash].js';
        webpackConfig.plugins = [...webpackConfig.plugins,
            require('map-json-webpack-plugin')({
                assetsPath: pkg.name,
            }),
        ];
    }
}

function getBizLibWebpackConfig(args) {

    let webpackConfig = getWebpackCommonConfig(args);

    const pkg = require(join(args.cwd, 'package.json'));

    webpackConfig.entry = {};
    webpackConfig.entry["biz_lib"] = [pkg[pkg.name]];

    webpackConfig.output.path = join(args.cwd, "libs/biz");
    webpackConfig.output.filename = "[name]-[hash].js";
    webpackConfig.output.library = pkg.name + "_[name]";
    webpackConfig.output.manifestname = join(args.cwd, "libs/biz", "[name]-manifest.json");

    addMpaasCommonRefs(args, webpackConfig);

    webpackConfig.plugins = [...webpackConfig.plugins,

        new webpack.DllPlugin({
            path: webpackConfig.output.manifestname,
            name: pkg.name + "_[name]"
        })
    ];

    addOtherPlugins(args, webpackConfig);
    return webpackConfig;
}


function getWrapperLibWebpackConfig(args) {
    let webpackConfig = getWebpackCommonConfig(args);

    const pkg = require(join(args.cwd, 'package.json'));

    webpackConfig.entry = {};
    webpackConfig.entry["wrapper_lib"] = [join(args.cwd, 'wrapper.jsx')];

    webpackConfig.output.path = join(args.cwd, "libs/wrapper");
    webpackConfig.output.filename = "[name]-[hash].js";
    webpackConfig.output.library = pkg.name + "_[name]";
    webpackConfig.output.manifestname = join(args.cwd, "libs/wrapper", "[name]-manifest.json");

    addMpaasCommonRefs(args, webpackConfig);

    webpackConfig.plugins = [...webpackConfig.plugins,

        new MpaasLibReferencePlugin({
            context: args.cwd,
            manifestname: join(args.cwd, './libs/biz/', 'biz_lib-manifest.json')
        }),

        new webpack.DllPlugin({
            path: webpackConfig.output.manifestname,
            name: pkg.name + "_[name]"
        })
    ]

    addOtherPlugins(args, webpackConfig);
    return webpackConfig;
}



function getLoaderLibWebpackConfig(args) {
    let webpackConfig = getWebpackCommonConfig(args);

    const pkg = require(join(args.cwd, 'package.json'));

    webpackConfig.entry = {};
    webpackConfig.entry["loader_lib"] = [join(args.cwd, 'loader.jsx')];

    webpackConfig.output.path = join(args.cwd, "libs/loader");
    webpackConfig.output.filename = "[name]-[hash].js";
    webpackConfig.output.library = pkg.name + "_[name]";
    webpackConfig.output.manifestname = join(args.cwd, "libs/loader", "[name]-manifest.json");

    addMpaasCommonRefs(args, webpackConfig);

    webpackConfig.plugins = [...webpackConfig.plugins,
        new MpaasLibReferencePlugin({
            context: args.cwd,
            manifestname: join(args.cwd, './libs/wrapper/', 'wrapper_lib-manifest.json')
        }),

        new webpack.DllPlugin({
            path: webpackConfig.output.manifestname,
            name: pkg.name + "_[name]"
        })
    ];

    addOtherPlugins(args, webpackConfig);
    return webpackConfig;
}


function getWebpackConfig(args) {
    const commonName = args.hash ? 'common-[chunkhash].js' : 'common.js';

    let webpackConfig = getWebpackCommonConfig(args);

    webpackConfig.plugins = webpackConfig.plugins || [];

    // Config outputPath.
    if (args.outputPath) {
        webpackConfig.output.path = args.outputPath;
    }

    if (args.publicPath) {
        webpackConfig.output.publicPath = args.publicPath;
    }


    webpackConfig.plugins = [...webpackConfig.plugins,
       // new webpack.optimize.CommonsChunkPlugin('common', commonName)
    ];

    addMpaasCommonRefs(args, webpackConfig);

    webpackConfig.plugins = [...webpackConfig.plugins,
        //new webpack.optimize.UglifyJsPlugin(webpackConfig.UglifyJsPluginConfig),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        }),

        new MpaasLibReferencePlugin({
            context: args.cwd,
            manifestname: join(args.cwd, './libs/biz/', 'biz_lib-manifest.json')
        }),

        new MpaasLibReferencePlugin({
            context: args.cwd,
            manifestname: join(args.cwd, './libs/wrapper/', 'wrapper_lib-manifest.json')
        }),
        new MpaasLibReferencePlugin({
            context: args.cwd,
            manifestname: join(args.cwd, './libs/loader/', 'loader_lib-manifest.json')
        }),

    ];


    addOtherPlugins(args, webpackConfig);

    webpackConfig = mergeCustomConfig(webpackConfig, resolve(args.cwd, args.config || 'webpack.config.js'));

    return webpackConfig;
}

export default function build(args, callback) {
    //create assist files
    const pkg = require(join(args.cwd, 'package.json'));
    fs.removeSync(join(args.cwd, "wrapper.jsx"));
    fs.outputFileSync(join(args.cwd, "wrapper.jsx"), "export default require('" + pkg[pkg.name] + "')");
    fs.removeSync(join(args.cwd, "loader.jsx"));
    fs.outputFileSync(join(args.cwd, "loader.jsx"), "export default require('./wrapper.jsx')");

    // Get config.
    let bizWebpackConfig = getBizLibWebpackConfig(args);
    let wrapperWebpackConfig = getWrapperLibWebpackConfig(args);
    let loaderWebpackConfig = getLoaderLibWebpackConfig(args);
    let webpackConfig = getWebpackConfig(args);
    //webpackConfig = [bizWebpackConfig, wrapperWebpackConfig, loaderWebpackConfig, webpackConfig];

    var fileOutputPath = webpackConfig.output.path;

    if (args.watch) {
        webpackConfig.forEach(config => {
            config.plugins.push(
                new ProgressPlugin((percentage, msg) => {
                    const stream = process.stderr;
                    if (stream.isTTY && percentage < 0.71) {
                        stream.cursorTo(0);
                        stream.write(`📦  ${chalk.magenta(msg)}`);
                        stream.clearLine(1);
                    } else if (percentage === 1) {
                        console.log(chalk.green('\nwebpack: bundle build is now finished.'));
                    }
                })
            );
        });
    }

    function doneHandler(err, stats) {
        if (args.json) {
            const filename = typeof args.json === 'boolean' ? 'build-bundle.json' : args.json;
            const jsonPath = join(fileOutputPath, filename);
            fs.writeFileSync(jsonPath, JSON.stringify(stats.toJson()), 'utf-8');
            console.log(`Generate Json File: ${jsonPath}`);
        }

        const { errors } = stats.toJson();
        if (errors && errors.length) {
            process.on('exit', () => {
                process.exit(1);
            });
        }
        // if watch enabled only stats.hasErrors would log info
        // otherwise  would always log info
        if (!args.watch || stats.hasErrors()) {
            const buildInfo = stats.toString({
                colors: true,
                children: true,
                chunks: !!args.verbose,
                modules: !!args.verbose,
                chunkModules: !!args.verbose,
                hash: !!args.verbose,
                version: !!args.verbose,
            });
            if (stats.hasErrors()) {
                console.error(buildInfo);
            } else {
                console.log(buildInfo);
            }
        }

        if (err) {
            process.on('exit', () => {
                process.exit(1);
            });
            console.error(err);
        }

        while (!fs.existsSync(join(webpackConfig.output.path, "map.json"))) {
            deasync.runLoopOnce();
        }

        var hash = {};
        copyFiles(join(args.cwd, './libs/mpaas_common/'), webpackConfig.output.path, hash);
        copyFiles(bizWebpackConfig.output.path, webpackConfig.output.path, hash);
        copyFiles(wrapperWebpackConfig.output.path, webpackConfig.output.path, hash);
        copyFiles(loaderWebpackConfig.output.path, webpackConfig.output.path, hash);
        Object.assign(hash, require(join(args.cwd, webpackConfig.output.path, "map.json")));

        fs.writeFileSync(join(args.cwd, webpackConfig.output.path, "map.json"),
            JSON.stringify(hash, null, 4), 'utf-8');


        if (callback) {
            callback(err);
        }
    }

    function over(err, stats) {

        const { errors } = stats.toJson();
        if (errors && errors.length) {
            process.on('exit', () => {
                process.exit(1);
            });
        }
        // if watch enabled only stats.hasErrors would log info
        // otherwise  would always log info
        if (!args.watch || stats.hasErrors()) {
            const buildInfo = stats.toString({
                colors: true,
                children: true,
                chunks: !!args.verbose,
                modules: !!args.verbose,
                chunkModules: !!args.verbose,
                hash: !!args.verbose,
                version: !!args.verbose,
            });
            if (stats.hasErrors()) {
                console.error(buildInfo);
            } else {
                console.log(buildInfo);
            }
        }

        if (err) {
            process.on('exit', () => {
                process.exit(1);
            });
            console.error(err);
        }
    }


    function deleteDir(path) {
        if (fs.existsSync(path)) {
            var files = fs.readdirSync(path); //读取该文件夹
            files.forEach(function(file) {
                var stats = fs.statSync(path + '/' + file);
                if (stats.isDirectory()) {
                    deleteDir(path + '/' + file);
                } else {
                    fs.unlinkSync(path + '/' + file);
                }
            });
        }
    }

    function copyFiles(srcpath, despath, hash) {
        if (fs.existsSync(srcpath)) {
            var files = fs.readdirSync(srcpath); //读取该文件夹
            files.forEach(function(file) {
                var stats = fs.statSync(join(srcpath, file));
                if (stats.isFile()) {
                    if (file === "map.json") {
                        //map.json
                        Object.assign(hash, require(join(srcpath, file)));
                    } else if (file.indexOf("manifest.json", file.length - "manifest.json".length) !== -1) {
                        //manifest file
                    } else {
                        fs.copySync(join(srcpath, file), join(despath, file));
                    }
                }
            });
        }
    }


    deleteDir(bizWebpackConfig.output.path);
    var compiler = webpack(bizWebpackConfig);
    compiler.run(over);
    while (!fs.existsSync(join(bizWebpackConfig.output.path, "map.json"))) {
        deasync.runLoopOnce();
    }

    deleteDir(wrapperWebpackConfig.output.path);
    compiler = webpack(wrapperWebpackConfig);
    compiler.run(over);
    while (!fs.existsSync(join(wrapperWebpackConfig.output.path, "map.json"))) {
        deasync.runLoopOnce();
    }

    deleteDir(loaderWebpackConfig.output.path);
    compiler = webpack(loaderWebpackConfig);
    compiler.run(over);
    while (!fs.existsSync(join(loaderWebpackConfig.output.path, "map.json"))) {
        deasync.runLoopOnce();
    }

    deleteDir(webpackConfig.output.path);
    compiler = webpack(webpackConfig);
    compiler.run(doneHandler);

    //delete assist files
    fs.removeSync(join(args.cwd, "wrapper.jsx"));
    fs.removeSync(join(args.cwd, "loader.jsx"));

}