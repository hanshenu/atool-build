import webpack from 'webpack';
import fs from 'fs';
import { join, resolve } from 'path';

function MpaasLibsBuildPlugin(options) {
    this.options = options || [];
}
module.exports = MpaasLibsBuildPlugin;
MpaasLibsBuildPlugin.prototype.apply = function(compiler) {
    compiler.plugin("this-compilation", function(compilation, params) {
        var webconfigs = this.options;
        // Run compiler.

        var i = 0;
        var tmpfile = join(process.cwd(), ".tmpfile");
        var wfd = fs.openSync(tmpfile, 'w+');

        function next() {
            i++;
            if (i >= webconfigs.length) {
                fs.writeSync(wfd, "OK");
                fs.closeSync(wfd);
                return;
            }
            compiler = webpack(webconfigs[i]);
            compiler.run(next);
        }
        compiler = webpack(webconfigs[0]);
        compiler.run(next);


        //var rfd = fs.openSync(tmpfile,'r');		
        //const Buffer = require('buffer').Buffer;
        //var buf = new Buffer([ 0x68, 0x65, 0x6c, 0x6c, 0x6f ]) ; 
        //const buf = Buffer.from('123');;
        //var count = fs.readSync(rfd,buf,0,2);
        //fs.closeSync(rfd);
        fs.unlinkSync(tmpfile);


    }.bind(this));
};