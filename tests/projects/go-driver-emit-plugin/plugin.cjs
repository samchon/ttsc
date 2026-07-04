const path = require("node:path");

module.exports = (context) => ({
  name: "go-driver-emit-plugin",
  source: path.resolve(context.dirname, "go-plugin"),
});
