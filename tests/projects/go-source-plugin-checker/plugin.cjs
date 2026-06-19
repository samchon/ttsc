const path = require("node:path");

module.exports = (context) => ({
  name: "go-source-plugin-checker",
  source: path.resolve(context.dirname, "go-plugin"),
});
