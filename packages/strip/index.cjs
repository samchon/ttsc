// @ts-check
"use strict";

const path = require("node:path");

module.exports = function createTtscStrip() {
  return {
    name: "@ttsc/strip",
    native: {
      mode: "ttsc-strip",
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
