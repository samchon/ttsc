const path = require("node:path");

module.exports = {
  name: "go-source-plugin-tsgo",
  native: {
    mode: "go-tsgo-tag",
    source: {
      dir: path.resolve(__dirname, "go-plugin"),
    },
    contractVersion: 1,
  },
};
