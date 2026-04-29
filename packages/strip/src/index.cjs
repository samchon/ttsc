// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscStrip() {
  return {
    name: "@ttsc/strip",
    native: {
      mode: "ttsc-strip",
      source: {
        dir: path.resolve(__dirname, ".."),
        entry: "./plugin",
      },
      contractVersion: 1,
      capabilities: ["output"],
    },
  };
};
