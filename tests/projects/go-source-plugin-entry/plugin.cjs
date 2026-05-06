const path = require("node:path");

module.exports = {
  name: "go-source-plugin-entry",
  source: path.resolve(__dirname, "go-plugin", "cmd", "transformer"),
};
