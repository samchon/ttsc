const fs = require("node:fs");
const path = require("node:path");
// Package resolvers inspect the process registry before calling Node; the
// runtime's module-local copy alone cannot advertise TypeScript to them.
const extensions = require("node:module")._extensions;
const aliasTarget = Object.keys(extensions)
  .map((extension) => path.join(__dirname, "config" + extension))
  .find((candidate) => fs.existsSync(candidate));
module.exports = {
  config: typeof require.extensions[".ts"] === "function" ? require("./config.ts").value : "missing-typescript-handler",
  lone: require("./both/y"),
  loneResolved: require.resolve("./both/y").endsWith("y.ts"),
  nodeHandler: require.extensions[".ts"] === require.extensions[".js"],
  precedence: require("./both/x"),
  globalHandler: [".ts", ".tsx", ".cts"].every((extension) => extensions[extension] === extensions[".js"]),
  alias: aliasTarget === undefined ? "missing-alias-target" : require(aliasTarget).value,
};
