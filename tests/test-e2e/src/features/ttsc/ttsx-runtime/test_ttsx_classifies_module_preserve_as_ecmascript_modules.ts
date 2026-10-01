import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx classifies `module: "preserve"` as ECMAScript modules inside a
 * CommonJS package.
 *
 * `preserve` keeps the authored `import`/`export` syntax verbatim — tsgo does
 * not rewrite it for the package type — so the emit is an ES module no matter
 * what the manifest says. The classifier used to route `preserve` to the
 * nearest `package.json` alongside the `node*` family, answered CommonJS in a
 * package with no `"type"`, and Node failed to find the named export in what it
 * was told was a CommonJS module.
 *
 * 1. Create a `module: "preserve"` project in a package with no `"type"`.
 * 2. Run ttsx against an entry that imports a named export from a sibling.
 * 3. Assert the run succeeds and the imported binding arrived.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx executes a preserve-mode entry importing a named sibling in a package without type; exact preserve-stays-esm output and zero status reject serving preserved exports as CommonJS.
 * @evidence contracts/testing.md#independent-expectations The preserve emit contract retains authored import/export syntax regardless of CommonJS package default; literal exported text defines the observed value independently of the classifier.
 * @evidence contracts/testing.md#distinguishing-cases Preserve mode against the contrary silent package type is the distinguishing profile; RuntimeModuleFormat source units separately own preserve across all package types and the CommonJS counterexample.
 * @evidence contracts/testing.md#execution-ownership This matching named E2E entry connects one actual compiler preparation and Node host; portable classification permutations execute only in source units.
 * @evidence contracts/e2e.md#necessary-boundary The compiler preserve profile and Node ESM label must connect for actual named imports; the direct returned format cannot detect wrong caller metadata or serving a stale CommonJS body.
 * @evidence contracts/e2e.md#shared-execution One two-module preserve program and host execute this profile; the forwarded-module case still repeats preserve preparation and is a consolidation candidate requiring the config-versus-CLI ownership proof.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One immutable package/config/source fixture has no prior output, and synchronous child completion precedes TestProject cleanup; no cache invalidation is hidden by reuse.
 * @evidence contracts/e2e.md#preserved-coverage Original exact output and zero status remain; no claim that the current standalone lifetime is already the minimum supported batch.
 */
export function test_ttsx_classifies_module_preserve_as_ecmascript_modules() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_classifies_module_preserve_as_ecmascript_modules/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "preserve-stays-esm");
  }
