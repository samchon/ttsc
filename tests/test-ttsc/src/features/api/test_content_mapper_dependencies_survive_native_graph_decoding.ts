import assert from "node:assert/strict";

import { mergeCheckGraphs } from "../../../../../packages/ttsc/src/compiler/internal/build/appendBuildOutput";
import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { toCompilerTransformation } from "../../../../../packages/ttsc/src/internal/CompilerResultAdapter";

/**
 * Verifies graph-declared mapper inputs reach every output dependency list.
 *
 * Third-party hosts can return the driver graph without calling its separate
 * dependency accessor, so result adaptation must retain universal mapper
 * inputs.
 *
 * 1. Decode source and diagnostic-only envelopes with mapper inputs.
 * 2. Require plugin inputs, completeness and literal reserved keys to survive.
 * 3. Contrast empty and malformed optional mapper lists.
 *
 * @evidence contracts/testing.md#behavioral-verification Native decoding and public result adaptation merge mapper inputs into every source and graph member on success and failure, retaining plugin dependencies, completeness and an own __proto__ key; check-phase graph composition retains both input lists.
 * @evidence contracts/testing.md#independent-expectations Authored manifest/schema/plugin input literals define universal versus per-file dependencies; exact arrays catch lost or duplicated paths independently of compiler output.
 * @evidence contracts/testing.md#distinguishing-cases Source output and empty diagnostic output, complete and unlisted members, duplicate inputs, reserved own keys and absent/malformed lists cover metadata transport boundaries.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit calls maintained parser, phase combiner and result adapter on in-memory values without a compiler, process, installation or filesystem fixture.
 */
export function test_content_mapper_dependencies_survive_native_graph_decoding(): void {
  for (const typescript of [{ "main.ts": "export {};" }, {}]) {
    const decoded = parseNativeTransformOutput(
      JSON.stringify({
        typescript,
        dependencies: Object.fromEntries([
          ["main.ts", ["plugin.json", "schema.json"]],
          ["other.ts", ["other.json"]],
        ]),
        dependenciesComplete: ["main.ts"],
        graph: {
          edges: Object.fromEntries([
            ["main.ts", []],
            ["__proto__", []],
          ]),
          globals: [],
          configs: [],
          contentMapperInputs: [
            "mapper/package.json",
            "schema.json",
            "schema.json",
          ],
        },
      }),
      "",
    );
    const parsed = toCompilerTransformation({
      ...decoded,
      result: {
        status: Object.keys(typescript).length ? 0 : 1,
        stdout: "",
        stderr: "",
        diagnostics: [],
      },
    });
    assert.equal(
      parsed.type,
      Object.keys(typescript).length ? "success" : "failure",
    );
    assert.deepEqual(parsed.dependencies?.["main.ts"], [
      "plugin.json",
      "schema.json",
      "mapper/package.json",
    ]);
    assert.deepEqual(parsed.dependencies?.["other.ts"], ["other.json"]);
    assert.equal(Object.hasOwn(parsed.dependencies!, "__proto__"), true);
    assert.deepEqual(parsed.dependencies?.["__proto__"], [
      "mapper/package.json",
      "schema.json",
    ]);
    assert.deepEqual(parsed.dependenciesComplete, ["main.ts"]);
  }
  for (const contentMapperInputs of [undefined, []]) {
    const result = parseNativeTransformOutput(
      JSON.stringify({
        typescript: {},
        graph: { edges: {}, globals: [], configs: [], contentMapperInputs },
      }),
      "",
    );
    assert.equal(result.dependencies, undefined);
  }
  for (const contentMapperInputs of [
    null,
    "schema.json",
    [null, 1],
    ["schema.json", ""],
  ])
    assert.throws(
      () =>
        parseNativeTransformOutput(
          JSON.stringify({ typescript: {}, graph: { contentMapperInputs } }),
          "",
        ),
      /invalid native content mapper inputs/,
    );
  assert.deepEqual(
    mergeCheckGraphs(
      {
        edges: {},
        configs: [],
        globals: [],
        contentMapperInputs: ["first", "shared"],
      },
      {
        edges: {},
        configs: [],
        globals: [],
        contentMapperInputs: ["second", "shared"],
      },
    )?.contentMapperInputs,
    ["first", "shared", "second"],
  );
}

/**
 * Verifies native root settings survive decoding and contradictory phases fail
 * proof.
 *
 * 1. Decode a metadata-only graph with native suffixes and null outputs.
 * 2. Reject malformed suffix/directory reports rather than silently losing them.
 * 3. Contrast matching and conflicting check-phase settings.
 *
 * @evidence contracts/testing.md#behavioral-verification The real native decoder preserves membership without edges; real check composition retains matching settings and records conflicting-check-membership-policy for contradictory reports.
 * @evidence contracts/testing.md#independent-expectations Authored suffixes, null outputs and literal failure reasons define expected transport and refusal independently of native compiler output.
 * @evidence contracts/testing.md#distinguishing-cases Metadata-only reports, absent/malformed fields, empty or invalid suffixes, relative paths, equal phase reports, conflicting extensions and an own __proto__ edge distinguish valid settings from unavailable, contradictory or lost proof.
 * @evidence contracts/testing.md#execution-ownership The API unit runner discovers this direct in-memory decoder/combiner test; no process or fixture installation is needed.
 */
export function test_native_membership_settings_survive_graph_composition(): void {
  const membership = {
    inputExtensions: [".ts", ".sql"],
    outDir: null,
    declarationDir: null,
  };
  const decode = (report: unknown) =>
    parseNativeTransformOutput(
      JSON.stringify({ typescript: {}, graph: { membership: report } }),
      "",
    );
  assert.deepEqual(decode(membership).graph?.membership, membership);
  for (const report of [
    null,
    {},
    { ...membership, inputExtensions: [] },
    { ...membership, inputExtensions: ["."] },
    { ...membership, inputExtensions: ["sql"] },
    { ...membership, inputExtensions: [".a/b"] },
    { ...membership, outDir: "relative" },
  ])
    assert.throws(
      () => decode(report),
      /invalid native compiler membership policy/,
    );
  const left = {
    edges: Object.fromEntries([
      ["main.ts", []],
      ["__proto__", []],
    ]),
    globals: [],
    configs: [],
    membership,
  };
  assert.deepEqual(mergeCheckGraphs(left, left)?.membership, membership);
  const conflict = mergeCheckGraphs(left, {
    ...left,
    membership: { ...membership, inputExtensions: [".ts"] },
  });
  assert.equal(conflict?.membership, undefined);
  assert.equal(Object.hasOwn(conflict!.inputProofFailures!, "__proto__"), true);
  assert.equal(
    conflict?.inputProofFailures?.["__proto__"],
    "conflicting-check-membership-policy",
  );
  assert.equal(
    conflict?.inputProofFailures?.["main.ts"],
    "conflicting-check-membership-policy",
  );
}
