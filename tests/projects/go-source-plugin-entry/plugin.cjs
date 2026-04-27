const path = require("node:path");

module.exports = {
  name: "go-source-plugin-entry",
  native: {
    mode: "go-uppercase",
    source: {
      dir: path.resolve(__dirname, "go-plugin"),
      entry: "./cmd/transformer",
    },
    contractVersion: 1,
  },
};
