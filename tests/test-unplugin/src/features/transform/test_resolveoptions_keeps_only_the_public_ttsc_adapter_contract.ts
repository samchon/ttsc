import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that `resolveOptions` returns an object with exactly the three
 * public keys (`compilerOptions`, `plugins`, `project`) and that each value is
 * preserved verbatim.
 *
 * Guards against accidental key additions or removals that would widen or
 * narrow the public adapter contract.
 */
export async function test_resolveoptions_keeps_only_the_public_ttsc_adapter_contract(): Promise<void> {
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
