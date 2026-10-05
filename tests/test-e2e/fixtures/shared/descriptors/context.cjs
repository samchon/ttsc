const fs = require("node:fs");
const path = require("node:path");
module.exports = (context) => {
  const filename = fs.realpathSync.native(__filename);
  if (context.filename !== __filename || context.dirname !== __dirname || context.filename !== filename || context.dirname !== path.dirname(filename))
    throw new Error("descriptor factory context lost its own physical module identity: " + JSON.stringify({ contextFilename: context.filename, contextDirname: context.dirname, ambientFilename: __filename, ambientDirname: __dirname, physicalFilename: filename }));
  fs.writeFileSync(context.plugin.contextProbe, JSON.stringify({
    filename: context.filename, dirname: context.dirname,
    ambientFilename: __filename, ambientDirname: __dirname,
  }));
  return { name: context.plugin.name, source: context.plugin.fixtureSource };
};
