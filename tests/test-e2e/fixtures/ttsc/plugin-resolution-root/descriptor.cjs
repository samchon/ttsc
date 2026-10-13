const { createRequire } = require("node:module");
const path = require("node:path");

module.exports = (context) => {
  const consumer = createRequire(path.join(context.projectRoot, "package.json"));
  const manifest = consumer.resolve("isolated-root-plugin/package.json");
  if (path.dirname(manifest) !== context.dirname) {
    throw new Error("descriptor package resolved from another owner");
  }
  return {
    name: context.plugin.name,
    source: context.plugin.fixtureSource,
    hostInputHashes: {},
  };
};
