// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscBanner() {
  return {
    name: "@ttsc/banner",
    source: path.resolve(__dirname, "..", "plugin"),
    stage: "output",
  };
};
