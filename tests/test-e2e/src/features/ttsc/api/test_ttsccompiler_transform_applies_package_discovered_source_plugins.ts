import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
  writePackageCompilerPlugin,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.transform applies package-discovered source plugins.
 *
 * Mirrors the `compile()` package-discovery test but for the `transform()`
 * path. Plugins declared in `package.json` must be discovered and applied when
 * the caller only wants transformed TypeScript source without a full emit. Pins
 * the auto-discovery path through the `transform()` surface so bundlers using
 * the source-only pipeline get the same plugin treatment as `compile()`.
 *
 * 1. Create a project with a plugin declared in `package.json` only.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the typescript map contains the plugin-transformed source.
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms a package-discovered plugin fixture and requires src/main.ts to contain export const value = "PLUGIN", success and no dist.
 * @evidence contracts/testing.md#independent-expectations The input goUpper("plugin") and separately authored fixture backend specify the uppercase replacement; the assertion checks source text rather than emitted JavaScript.
 * @evidence contracts/testing.md#distinguishing-cases This package-discovery source positive complements compile output discovery; plain transform preserves typed source and nearest-manifest compile checks discovery termination.
 * @evidence contracts/testing.md#execution-ownership The matching feature export is discovered by TestExecutor and executes a built Go plugin through transform.
 * @evidence contracts/e2e.md#necessary-boundary Package discovery must deliver a native plugin whose source envelope reaches the public transform result; decoder or manifest units cannot prove the assembled connection.
 * @evidence contracts/e2e.md#shared-execution One transform supplies source and publication checks; built packages and keyed plugin cache are shared. writePackageCompilerPlugin now uses the process-owned immutable compiler source rather than materializing a private identical module.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh registered project owns its manifest, input and plugin descriptor, so result text cannot come from another project. The keyed binary may be reused only for equivalent source/build inputs; fixture cleanup is suite-owned.
 * @evidence contracts/e2e.md#preserved-coverage Success, exact transformed declaration snippet and no-dist assertions remain. The programmed fixture does not prove arbitrary AST transformations or complete generated-program semantics.
 */
export const test_ttsccompiler_transform_applies_package_discovered_source_plugins =
  () => {
    const root = createProject({
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writePackageCompilerPlugin(root, "compile-fixture");
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /export const value = "PLUGIN"/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };
