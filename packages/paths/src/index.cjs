// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscPaths() {
  return {
    name: "@ttsc/paths",
    source: path.resolve(__dirname, "..", "plugin"),
    stage: "output",
  };
};
