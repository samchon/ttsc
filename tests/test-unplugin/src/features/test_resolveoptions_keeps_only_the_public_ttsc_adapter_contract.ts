import assert from "node:assert/strict";

import { resolveOptions } from "../../../../packages/unplugin/src/core/options/resolveOptions";

/**
 * Verifies `resolveOptions` preserves each supported option choice and value.
 *
 * The resolved options are the adapter contract every host passes to the
 * transform. Adding or dropping a key would widen or narrow that contract
 * without anyone noticing.
 *
 * 1. Resolve options carrying startup entries, compiler, plugin, config and source-root choices.
 * 2. Assert each supported choice survives normalization.
 * 3. Assert each value is preserved verbatim.
 * 4. Assert omission, explicit disable, and array/overlay copying retain their meaning.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveOptions preserves precompile/compilerOptions/plugins/project/projectRoot, retains omission versus false, and detaches the startup entry array and compiler option overlay from their caller.
 * @evidence contracts/testing.md#independent-expectations Literal five-key and option objects independently specify the public result; mutating the resolved strict flag must leave the authored overlay unchanged, and mutating the caller's entry array must leave the resolved startup list unchanged.
 * @evidence contracts/testing.md#distinguishing-cases Explicit relative startup entries and source root, their omitted defaults, populated options, omitted options, plugins false versus undefined and array/overlay mutation distinguish value preservation from aliasing.
 * @evidence contracts/testing.md#execution-ownership This exported entry calls resolveOptions directly with in-memory values; its assertions own both normalized object and caller immutability, without a consumer.
 */
export async function test_resolveoptions_keeps_only_the_public_ttsc_adapter_contract(): Promise<void> {
  const options = resolveOptions({
    compilerOptions: {
      module: "commonjs",
      plugins: [{ transform: "typia/lib/transform" }],
    },
    plugins: [{ transform: "./plugin.cjs", custom: true }],
    precompile: ["src/main.ts", "../shared/src/index.ts"],
    project: "tsconfig.build.json",
    projectRoot: "../workspace",
  });

  assert.deepEqual(Object.keys(options).sort(), [
    "compilerOptions",
    "plugins",
    "precompile",
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
  assert.deepEqual(options.precompile, ["src/main.ts", "../shared/src/index.ts"]);

  assert.deepEqual(resolveOptions(), {
    compilerOptions: {},
    plugins: undefined,
    precompile: undefined,
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
  const entries = ["src/main.ts"];
  const prepared = resolveOptions({ precompile: entries });
  assert.notEqual(prepared.precompile, entries);
  entries.push("src/later.ts");
  assert.deepEqual(
    prepared.precompile,
    ["src/main.ts"],
    "normalization detaches startup entries",
  );
}
