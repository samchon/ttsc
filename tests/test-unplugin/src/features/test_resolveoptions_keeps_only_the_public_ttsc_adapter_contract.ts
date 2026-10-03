import assert from "node:assert/strict";

import { resolveOptions } from "../../../../packages/unplugin/src/core/options/resolveOptions";

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
 * 4. Assert omission, explicit disable, and overlay copying retain their meaning.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveOptions preserves exactly compilerOptions/plugins/project, retains omission versus false, and detaches the compiler option overlay from its caller.
 * @evidence contracts/testing.md#independent-expectations Literal three-key and option objects independently specify the public result; mutating the resolved strict flag must leave the authored input true.
 * @evidence contracts/testing.md#distinguishing-cases Populated options, omitted options, plugins false versus undefined and overlay mutation distinguish value preservation from aliasing.
 * @evidence contracts/testing.md#execution-ownership This exported entry calls resolveOptions directly with in-memory values; its assertions own both normalized object and caller immutability, without a consumer.
 */
export async function test_resolveoptions_keeps_only_the_public_ttsc_adapter_contract(): Promise<void> {
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

  assert.deepEqual(resolveOptions(), {
    compilerOptions: {},
    plugins: undefined,
    project: undefined,
  });
  assert.equal(resolveOptions({ plugins: false }).plugins, false);
  assert.equal(resolveOptions({ plugins: undefined }).plugins, undefined);
  const compilerOptions = { strict: true };
  const resolved = resolveOptions({ compilerOptions });
  assert.notEqual(resolved.compilerOptions, compilerOptions);
  resolved.compilerOptions.strict = false;
  assert.equal(
    compilerOptions.strict,
    true,
    "normalization detaches the overlay",
  );
}
