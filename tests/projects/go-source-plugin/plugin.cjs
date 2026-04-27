const path = require("node:path");

module.exports = {
  name: "go-source-plugin",
  native: {
    mode: "go-uppercase",
    source: {
      dir: path.resolve(__dirname, "go-plugin"),
    },
    contractVersion: 1,
    capabilities: ["transform"],
  },
};
