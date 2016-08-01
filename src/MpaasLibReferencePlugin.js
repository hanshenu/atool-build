import webpack from 'webpack';

function MpaasLibReferencePlugin(options) {
    this.options = options;
}
module.exports = MpaasLibReferencePlugin;

MpaasLibReferencePlugin.prototype.apply = function(compiler) {
    this.options.manifest = require(this.options.manifestname);
    compiler.apply(new webpack.DllReferencePlugin(this.options));
};