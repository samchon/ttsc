// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscBanner() {
  return {
    name: "@ttsc/banner",
    native: {
      mode: "ttsc-banner",
      source: {
        dir: path.resolve(__dirname, ".."),
        entry: "./plugin",
      },
      contractVersion: 1,
      capabilities: ["output"],
    },
  };
};
