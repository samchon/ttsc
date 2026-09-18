import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `resolveOptions` returns exactly the three public keys and preserves
 * each value.
 *
 * The resolved options are the adapter contract every host passes to the
 * transform. Adding or dropping a key would widen or narrow that contract
 * without anyone noticing.
 *
 * 1. Resolve options carrying `compilerOptions`, `plugins`, and `project`.
 * 2. Assert exactly those three keys are returned.
 * 3. Assert each value is preserved verbatim.
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
