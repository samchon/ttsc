import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

async function assertResolveOptionsKeepsOnlyPublicContract() {
  const { resolveOptions } = await TestUnpluginRuntime.loadUnpluginApi();
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

export { assertResolveOptionsKeepsOnlyPublicContract };
