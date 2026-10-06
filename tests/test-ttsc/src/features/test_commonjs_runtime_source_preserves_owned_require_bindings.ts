import assert from "node:assert/strict";
import NativeModule, { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import { CommonJsRuntimeSource } from "../../../../packages/ttsc/src/launcher/internal/runtime/CommonJsRuntimeSource";

/**
 * Verifies source bootstrap keeps CommonJS user bindings and resolution policy.
 *
 * Hoisted user declarations shadow wrapper parameters before the first source
 * statement. Removing the helper's public cache entry must also leave the
 * runtime's already-configured policy authoritative for the prepared body.
 *
 * 1. Compare native and prepared execution for each wrapper/global binding.
 * 2. Configure an owned alias policy and remove only the helper's cache entry.
 * 3. Assert the policy still resolves that alias, then restore owned state.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual CommonJsRuntimeSource.prepare and executes its output with vm.compileFunction; distinguishes hoisted filename binding failure and loss of the configured resolver after helper cache removal.
 * @evidence contracts/testing.md#independent-expectations Native vm.compileFunction execution supplies the binding oracle; the resolver alias has a literal caller-owned destination independent of bootstrap construction.
 * @evidence contracts/testing.md#distinguishing-cases Sweeps require, module, exports, __filename, __dirname and globalThis declarations, strict filename shadowing and a nested non-hoisted filename; checks configured resolution before and after helper cache removal. The owned module API retains shared identity, reflected createRequire, cache identity, string and file-URL anchors, options.paths identity and native missing-module/invalid-anchor errors without changing Node's original export.
 * @evidence contracts/testing.md#execution-ownership The matching named source-unit entry imports the authored namespace directly; no compiler, consumer installation or product host is started. It restores the exact helper cache entry and default policy in finally.
 */
export function test_commonjs_runtime_source_preserves_owned_require_bindings(): void {
  const filename = path.resolve("owned-commonjs-binding.cjs");
  const native = createRequire(import.meta.url);
  const execute = (source: string): unknown => {
    const module = { exports: {} as unknown };
    vm.compileFunction(
      source,
      ["exports", "require", "module", "__filename", "__dirname"],
      { filename },
    )(module.exports, native, module, filename, path.dirname(filename));
    return module.exports;
  };
  const sources = [
    ...["__filename", "__dirname", "globalThis", "module", "exports"].map(
      (binding) => `function ${binding}(){};module.exports=42;`,
    ),
    '"use strict";function __filename(){};module.exports=42;',
    'function require(){return 42;}module.exports=require("owned");',
    "function nested(){function __filename(){};}module.exports=42;",
  ];
  const failures: Error[] = [];
  for (const source of sources) {
    try {
      assert.deepEqual(
        execute(CommonJsRuntimeSource.prepare(source, filename)),
        execute(source),
        source,
      );
    } catch (error) {
      failures.push(new Error(source, { cause: error }));
    }
  }

  const helper = Object.entries(native.cache).find(
    ([, entry]) =>
      entry?.exports?.CommonJsRuntimeSource === CommonJsRuntimeSource,
  );
  assert.ok(helper, "authored helper must be loaded before preparing source");
  const [helperPath, helperModule] = helper;
  const destination = path.resolve("owned-policy-target.ts");
  CommonJsRuntimeSource.configure((resolve, specifier, options) =>
    specifier === "owned-policy" ? destination : resolve(specifier, options),
  );
  try {
    const source = 'module.exports=require.resolve("owned-policy");';
    for (const evicted of [false, true]) {
      try {
        if (evicted) delete native.cache[helperPath];
        assert.equal(
          execute(CommonJsRuntimeSource.prepare(source, filename)),
          destination,
          `configured resolution with helper evicted=${evicted}`,
        );
      } catch (error) {
        failures.push(new Error(`helper evicted=${evicted}`, { cause: error }));
      }
    }
  } finally {
    native.cache[helperPath] = helperModule;
    CommonJsRuntimeSource.configure((resolve, specifier, options) =>
      resolve(specifier, options),
    );
  }
  const calls: Array<{ filename: string; specifier: string; options: unknown }> = [];
  CommonJsRuntimeSource.configure((resolve, specifier, options, anchor) => {
    calls.push({ filename: anchor, specifier, options });
    if (specifier === "owned-policy") return destination;
    return resolve(specifier, options);
  }, true);
  try {
    const owned = CommonJsRuntimeSource.create(native, filename);
    const api = owned("node:module") as typeof NativeModule;
    assert.notEqual(api, NativeModule);
    assert.equal(api, owned("module"));
    assert.equal(api.Module, api);
    assert.equal(NativeModule.createRequire, createRequire);
    assert.equal(api.isBuiltin, NativeModule.isBuiltin);
    assert.equal(Object.getOwnPropertyDescriptor(api, "createRequire")!.value, api.createRequire);
    const options = { paths: [path.dirname(filename)] };
    for (const anchor of [filename, pathToFileURL(filename)]) {
      const scoped = api.createRequire(anchor);
      assert.equal(scoped.resolve("owned-policy", options), destination);
      assert.equal(calls.at(-1)!.filename, filename);
      assert.equal(calls.at(-1)!.options, options);
      assert.equal(scoped.cache, native.cache);
      assert.equal(scoped("node:module"), api);
      assert.throws(() => scoped.resolve("owned-missing-module"), { code: "MODULE_NOT_FOUND" });
    }
    assert.throws(() => api.createRequire("relative.cjs"), { code: "ERR_INVALID_ARG_VALUE" });
  } catch (cause) {
    failures.push(new Error("owned module API retains anchored resolver and native failures", { cause }));
  } finally {
    CommonJsRuntimeSource.configure((resolve, specifier, options) => resolve(specifier, options));
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "CommonJS bootstrap changed owned behavior",
    );
}
