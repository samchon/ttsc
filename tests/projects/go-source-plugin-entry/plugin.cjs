const path = require("node:path");

module.exports = (context) => ({
  name: "go-source-plugin-entry",
  source: path.resolve(context.dirname, "go-plugin", "cmd", "transformer"),
});
