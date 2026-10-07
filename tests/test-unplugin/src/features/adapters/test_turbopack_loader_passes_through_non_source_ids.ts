import assert from "node:assert/strict";
import path from "node:path";

import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import type { TtscTurbopackLoaderContext } from "../../../../../packages/unplugin/src/core/turbopack/TtscTurbopackLoaderContext";
import type { TtscTurbopackLoaderOptions } from "../../../../../packages/unplugin/src/core/turbopack/TtscTurbopackLoaderOptions";
import { createTurbopackLoaderBindings } from "../../../../../packages/unplugin/src/core/turbopack/createTurbopackLoaderBindings";
import { TestProject } from "../../../../utils/src/TestProject";
import { runTurbopackLoader } from "../internal/adapter-turbopack/runTurbopackLoader";

/**
 * Verifies the Turbopack loader applies the shared transform-target filter, not
 * a subset of it (samchon/ttsc#1305).
 *
 * The loader used to re-implement two of `isTransformTarget`'s four conditions,
 * so a rule glob wider than `*.ts`/`*.tsx` routed JavaScript and virtual ids
 * into the whole-project transform every other adapter excludes. A project
 * without `allowJs` has no program entry for such a file; that no longer fails
 * a build (samchon/ttsc#1308), but it still cost a whole-project compile that
 * could never produce output. The virtual row is defence in depth:
 * `transformTtsc` short-circuits a NUL id itself, so the observable passthrough
 * cannot distinguish that inner guard from the loader's own filter. The
 * declaration and `node_modules` rows stay pinned by
 * `test_turbopack_loader_passes_through_declarations_and_node_modules`.
 *
 * 1. Run the loader on `.js`, `.mjs`, `.cjs`, and `.jsx` siblings of a project
 *    source.
 * 2. Run it on a `\0` virtual id.
 * 3. Assert every source is returned unchanged. The production-used binding
 *    operation separately preserves selected callback receivers and live option
 *    reads. These calls certify context channel policy, not installed
 *    Turbopack, compiler output or project-record acquisition.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Calls the authored Turbopack loader with JavaScript and NUL virtual IDs;
 *   callback bytes must equal the supplied source instead of entering compilation.
 * @evidence contracts/testing.md#independent-expectations
 *   JavaScript and virtual IDs are excluded by the supported source contract.
 *   The exact supplied source is an independent byte-preservation expectation.
 *   The virtual row cannot locate rejection between the loader filter and the
 *   transform's NUL guard; it establishes the public passthrough result.
 * @evidence contracts/testing.md#distinguishing-cases
 *   js, mjs, cjs and jsx spellings plus a TypeScript-shaped virtual ID detect
 *   extension-only or virtual-guard omissions. The companion declaration unit
 *   owns declaration/vendor exclusions; packed hosts own accepted transforms.
 *   Binding rows contrast captured methods with live rule options, explicit
 *   plugins false with omission, absent channels and exact callback errors.
 * @evidence contracts/testing.md#execution-ownership
 *   test_turbopack_loader_passes_through_non_source_ids calls runTurbopackLoader for four JavaScript extensions and one NUL ID, owning each exact passthrough result and extension failure label; no native transform producer runs.
 */
export async function test_turbopack_loader_passes_through_non_source_ids(): Promise<void> {
  const root = TestProject.tmpdir("adapter-source-unit-");
  const script = 'export const value = goUpper("plugin");\n';
  for (const extension of ["js", "mjs", "cjs", "jsx"]) {
    const out = await runTurbopackLoader({
      resourcePath: path.join(root, "src", `sibling.${extension}`),
      source: script,
    });
    assert.equal(
      out,
      script,
      `a .${extension} module must pass through untouched, as every other adapter leaves it`,
    );
  }

  const virtual = "export const virtual = 1;\n";
  const virtualOut = await runTurbopackLoader({
    resourcePath: "\0virtual:module.ts",
    source: virtual,
  });
  assert.equal(
    virtualOut,
    virtual,
    "a virtual id must be filtered where every other adapter filters it",
  );

  type BindingContext = Pick<
    TtscTurbopackLoaderContext,
    "addDependency" | "cacheable" | "emitError" | "getOptions"
  >;
  const selections: string[] = [];
  const calls: unknown[][] = [];
  const diagnostic = new Error("authored loader diagnostic");
  const callbackFailure = new Error("authored context callback failure");
  let options: TtscTurbopackLoaderOptions = {
    project: "./configured-tsconfig.json",
    projectRoot: "../workspace",
    plugins: false,
    compilerOptions: { strict: true },
  };
  let dependency: NonNullable<BindingContext["addDependency"]> = function (
    this: BindingContext,
    input,
  ) {
    assert.equal(this, context);
    calls.push(["dependency", input]);
  };
  let cacheable: NonNullable<BindingContext["cacheable"]> = function (
    this: BindingContext,
    flag,
  ) {
    assert.equal(this, context);
    calls.push(["cacheable", flag]);
  };
  let emitError: NonNullable<BindingContext["emitError"]> = function (
    this: BindingContext,
    error,
  ) {
    assert.equal(this, context);
    calls.push(["error", error]);
  };
  const context: BindingContext = {
    get addDependency() {
      selections.push("dependency");
      return dependency;
    },
    get cacheable() {
      selections.push("cacheable");
      return cacheable;
    },
    get emitError() {
      selections.push("error");
      return emitError;
    },
    getOptions() {
      assert.equal(this, context);
      calls.push(["options"]);
      return options;
    },
  };
  const bindings = createTurbopackLoaderBindings(context);
  assert.deepEqual(selections, ["dependency", "cacheable", "error"]);
  assert.deepEqual(calls, [], "binding does not read the rule options early");
  dependency = function () {
    throw callbackFailure;
  };
  cacheable = function () {
    throw callbackFailure;
  };
  emitError = function () {
    throw callbackFailure;
  };
  bindings.addDependency!("./literal-input.d.ts");
  bindings.markVolatile!();
  bindings.emitError!(diagnostic);
  assert.deepEqual(
    calls,
    [
      ["dependency", "./literal-input.d.ts"],
      ["cacheable", false],
      ["error", diagnostic],
    ],
    "selected callbacks keep their original methods and context receiver",
  );
  assert.deepEqual(selections, ["dependency", "cacheable", "error"]);
  assert.equal(
    bindings.readOptions(),
    options,
    "the entire current rule options object is returned",
  );
  assert.deepEqual(resolveOptions(bindings.readOptions()), {
    project: "./configured-tsconfig.json",
    projectRoot: "../workspace",
    plugins: false,
    compilerOptions: { strict: true },
  });
  options = {
    project: "./replacement-tsconfig.json",
    compilerOptions: { strict: false },
  };
  assert.equal(
    bindings.readOptions(),
    options,
    "a later read observes the current option object",
  );
  context.getOptions = function () {
    assert.equal(this, context);
    throw callbackFailure;
  };
  assert.throws(
    () => bindings.readOptions(),
    (error) => error === callbackFailure,
  );

  const absent = createTurbopackLoaderBindings({});
  assert.equal(absent.addDependency, undefined);
  assert.equal(absent.emitError, undefined);
  assert.equal(absent.markVolatile, undefined);
  assert.deepEqual(absent.readOptions(), {});
  assert.deepEqual(
    createTurbopackLoaderBindings({
      getOptions() {
        return undefined;
      },
    }).readOptions(),
    {},
    "an explicitly unavailable options result uses the empty default",
  );
  for (const channel of ["addDependency", "cacheable", "emitError"] as const) {
    const failing = createTurbopackLoaderBindings({
      [channel]: function () {
        throw callbackFailure;
      },
    });
    assert.throws(
      () => {
        if (channel === "addDependency") failing.addDependency!("literal");
        else if (channel === "cacheable") failing.markVolatile!();
        else failing.emitError!(diagnostic);
      },
      (error) => error === callbackFailure,
    );
  }
}
