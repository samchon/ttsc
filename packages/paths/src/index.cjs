// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscPaths() {
  return {
    name: "@ttsc/paths",
    native: {
      mode: "ttsc-paths",
      source: {
        dir: path.resolve(__dirname, ".."),
        entry: "./plugin",
      },
      contractVersion: 1,
      capabilities: ["output"],
    },
  };
};
