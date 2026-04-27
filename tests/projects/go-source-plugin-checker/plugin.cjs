const path = require("node:path");

module.exports = {
  name: "go-source-plugin-checker",
  native: {
    mode: "type-name",
    source: {
      dir: path.resolve(__dirname, "go-plugin"),
    },
    contractVersion: 1,
  },
};
