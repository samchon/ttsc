const path = require("node:path");

module.exports = {
  name: "go-source-plugin-properties",
  native: {
    mode: "type-properties",
    source: {
      dir: path.resolve(__dirname, "go-plugin"),
    },
    contractVersion: 1,
  },
};
