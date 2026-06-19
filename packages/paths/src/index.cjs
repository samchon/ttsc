// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscPaths(context) {
  return {
    name: "@ttsc/paths",
    // `context.dirname` is this descriptor's own directory in every load mode —
    // the ESM-safe replacement for `__dirname`.
    source: path.resolve(context.dirname, "..", "driver"),
    stage: "transform",
  };
};
