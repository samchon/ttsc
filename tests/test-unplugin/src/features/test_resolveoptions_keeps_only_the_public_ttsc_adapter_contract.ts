import assert from "node:assert/strict";

import { resolveOptions } from "../../../../packages/unplugin/src/core/options/resolveOptions";

/**
 * Verifies `resolveOptions` preserves the four supported option choices and
 * each value.
 *
 * The resolved options are the adapter contract every host passes to the
 * transform. Adding or dropping a key would widen or narrow that contract
 * without anyone noticing.
 *
 * 1. Resolve options carrying compiler, plugin, config and source-root choices.
 * 2. Assert each supported choice survives normalization.
 * 3. Assert each value is preserved verbatim.
 * 4. Assert omission, explicit disable, and overlay copying retain their meaning.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveOptions preserves compilerOptions/plugins/project/projectRoot, retains omission versus false, and detaches the compiler option overlay from its caller.
 * @evidence contracts/testing.md#independent-expectations Literal four-key and option objects independently specify the public result; mutating the resolved strict flag must leave the authored input true.
 * @evidence contracts/testing.md#distinguishing-cases An explicit relative root, its omitted default, populated options, omitted options, plugins false versus undefined and overlay mutation distinguish value preservation from aliasing.
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
    projectRoot: "../workspace",
  });

  assert.deepEqual(Object.keys(options).sort(), [
    "compilerOptions",
    "plugins",
    "project",
    "projectRoot",
  ]);
  assert.deepEqual(options.compilerOptions, {
    module: "commonjs",
    plugins: [{ transform: "typia/lib/transform" }],
  });
  assert.deepEqual(options.plugins, [
    { transform: "./plugin.cjs", custom: true },
  ]);
  assert.equal(options.project, "tsconfig.build.json");
  assert.equal(options.projectRoot, "../workspace");

  assert.deepEqual(resolveOptions(), {
    compilerOptions: {},
    plugins: undefined,
    project: undefined,
    projectRoot: undefined,
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
