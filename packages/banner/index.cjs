// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscBanner() {
  return {
    name: "@ttsc/banner",
    native: {
      mode: "ttsc-banner",
      source: {
        dir: resolveSharedGoPlugin(),
      },
      contractVersion: 1,
      capabilities: ["check", "build", "transform"],
    },
  };
};

function resolveSharedGoPlugin() {
  try {
    const pkg = require.resolve("@ttsc/lint/package.json", {
      paths: [__dirname],
    });
    return path.join(path.dirname(pkg), "go-plugin");
  } catch {
    return path.resolve(__dirname, "..", "lint", "go-plugin");
  }
}
