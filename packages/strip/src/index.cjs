// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscStrip() {
  return {
    name: "@ttsc/strip",
    source: path.resolve(__dirname, "..", "driver"),
    stage: "transform",
  };
};
