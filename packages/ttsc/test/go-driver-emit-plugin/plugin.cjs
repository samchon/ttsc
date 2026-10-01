const path = require("node:path");

module.exports = (context) => ({
  name: "go-driver-emit-plugin",
  capabilities: { emitProvenance: true },
  source: path.resolve(context.dirname, "go-plugin"),
});
