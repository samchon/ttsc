import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx exposes nested `export *` names from a CommonJS-classified
 * source package to an ESM consumer's named import.
 *
 * A source-shipping package with no `type` field is CommonJS under Node's
 * package rules, but TypeScript authors still commonly write its source with
 * ESM `export *` syntax. tsgo lowers that star export to a dynamic CommonJS
 * helper that CJS consumers can read, while Node's ESM linker cannot statically
 * discover the re-exported names. ttsx must keep the CommonJS runtime path and
 * still make those names visible to the ESM named-import bridge.
 *
 * 1. Install a `lib` package with no `type` field whose TS entry re-exports value
 *    names through a nested `export *` chain, alongside `exports.<name> =`
 *    assignment-shaped decoys inside a comment, a block comment, a string, and
 *    a template literal.
 * 2. Run an ESM ttsx entry that imports `{ foo, bar }` from `lib`.
 * 3. Run a CJS ttsx entry that requires the same `lib` package.
 * 4. Assert both module formats observe the re-exported runtime values and that
 *    none of the assignment-shaped decoys leak into the namespace.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ESM named/default namespace linking and CommonJS require consume a nested typed star-export package; exact foo/bar/qux/grouped values and every ghost-name rejection distinguish incomplete bridging and false lexical exports.
 * @evidence contracts/testing.md#independent-expectations Independently authored literal runtime exports define the expected joined value; type-only and comment/string/template assignment decoys have no executable declaration and must be absent.
 * @evidence contracts/testing.md#distinguishing-cases Nested star exports, alias and namespace star are positive cases; type-only and seven inert lexical decoys are counterexamples for both ESM and CommonJS consumers.
 * @evidence contracts/testing.md#execution-ownership The filename-matching named E2E entry connects actual compiler emit with two native module-format consumers; source export-name decisions remain separately unit-owned.
 * @evidence contracts/e2e.md#necessary-boundary NativeNode ESM named linking cannot statically see dynamic CommonJS star helpers without the runtime facade; direct source-name analysis cannot establish that link or CommonJS interoperability.
 * @evidence contracts/e2e.md#shared-execution One immutable package graph and root workspace serve ESM and CommonJS hosts; different native module entry formats require separate host lifetimes, while package preparation is reused by its runtime identity.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture package source/version remains unchanged between consumers and each synchronous spawn ends its module cache before the next; no cold invalidation claim is made.
 * @evidence contracts/e2e.md#preserved-coverage Both original zero-status and exact export-value outputs remain, along with every type/comment/string/assignment ghost rejection in each consumer; floor/current select this unique native bridge and main24 retains all runtime cases.
 */
export function test_ttsx_exposes_nested_cjs_source_star_exports_to_esm_named_imports() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_exposes_nested_cjs_source_star_exports_to_esm_named_imports/inputs-1"));

    const esm = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(esm.status, 0, esm.stderr);
    assert.equal(esm.stdout.trim(), "foo-ok:bar-ok:renamed-ok:leaf-ok");

    const cjs = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/require.cts"],
      { cwd: root },
    );
    assert.equal(cjs.status, 0, cjs.stderr);
    assert.equal(cjs.stdout.trim(), "foo-ok:bar-ok:renamed-ok:leaf-ok");
  }
