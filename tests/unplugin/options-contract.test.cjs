const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveOptions } = require("../../packages/unplugin/lib/api.js");

test("resolveOptions keeps only the public ttsc adapter contract", () => {
  assertResolveOptionsKeepsOnlyPublicContract();
});

function assertResolveOptionsKeepsOnlyPublicContract() {
  const options = resolveOptions({
    compilerOptions: {
      module: "commonjs",
      plugins: [{ transform: "typia/lib/transform" }],
    },
    plugins: [{ transform: "./plugin.cjs", custom: true }],
    project: "tsconfig.build.json",
  });

  assert.deepEqual(Object.keys(options).sort(), [
    "compilerOptions",
    "plugins",
    "project",
  ]);
  assert.deepEqual(options.compilerOptions, {
    module: "commonjs",
    plugins: [{ transform: "typia/lib/transform" }],
  });
  assert.deepEqual(options.plugins, [
    { transform: "./plugin.cjs", custom: true },
  ]);
  assert.equal(options.project, "tsconfig.build.json");
}
