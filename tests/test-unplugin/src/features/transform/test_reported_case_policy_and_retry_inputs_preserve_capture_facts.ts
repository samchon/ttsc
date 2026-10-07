import assert from "node:assert/strict";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { carryTransformAttemptInputs } from "../../../../../packages/unplugin/src/core/transform/generation/carryTransformAttemptInputs";
import { selectReportedMembershipPolicy } from "../../../../../packages/unplugin/src/core/transform/generation/selectReportedMembershipPolicy";

/**
 * Verifies reported case policy and retry inputs retain their own provenance.
 *
 * Capture primes an explicit comparison rule before compilation. A different
 * reported rule changes that policy, while newly named dependencies are carried
 * by exact spelling for a new observation, not as reusable witness bytes.
 *
 * 1. Contrast missing, equal and opposite compiler reports for both primed rules.
 * 2. Carry repeated and distinct dependency spellings without mutating inputs.
 * 3. Contrast reported false/true with absent case policy and empty dependencies.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly calls selectReportedMembershipPolicy and carryTransformAttemptInputs used by actual capture/retry owners. Asserts policy identity without a report, explicit opposite learned flags, unchanged other policy fields, exact dependency insertion order and prior versus captured case selection.
 * @evidence contracts/testing.md#independent-expectations Explicit boolean primers and literal opposite/equal reports define expected learned values independently. Literal dependency spellings and insertion order distinguish accumulation from physical alias collapse; absent case report preserves the literal prior rule while explicit false must override true.
 * @evidence contracts/testing.md#distinguishing-cases Both primed rules contrast missing/equal/opposite success and failure reports and exception without a graph. Retry carry contrasts duplicate/unique/lexical alias spellings, empty/missing lists, absent prior, absent captured rule and both explicit captured booleans. Inputs retain contents/identity and the returned Set is separately owned.
 * @evidence contracts/testing.md#execution-ownership This discoverable source unit calls the actual production operations in process with caller-owned comparison facts. It invokes no filesystem, compiler, session, observer or host. Native capture evidence, dependency witness acquisition, case-policy retry walks and disposal are not certified here.
 */
export function test_reported_case_policy_and_retry_inputs_preserve_capture_facts(): void {
  const output = path.resolve("case-policy-input", "output");
  const config = path.resolve("case-policy-input", "config.json");
  for (const primer of [false, true]) {
    const primed = {
      excludedDirectories: [output],
      inputExtensions: [".ts", ".tsx"],
      sources: [config],
      useCaseSensitiveFileNames: primer,
    };
    const noReports: ITtscCompilerTransformation[] = [
      { type: "success", typescript: {} },
      {
        type: "success",
        typescript: {},
        graph: { edges: {}, globals: [], configs: [] },
      },
      { type: "failure", typescript: {}, diagnostics: [] },
      { type: "exception", error: new Error("literal no-report failure") },
    ];
    for (const result of noReports) {
      const selected = selectReportedMembershipPolicy(primed, result);
      assert.equal(selected.membershipPolicy, primed);
      assert.equal(selected.casePolicyLearned, false);
    }
    for (const [report, expectedLearned] of primer
      ? ([
          [true, false],
          [false, true],
        ] as const)
      : ([
          [false, false],
          [true, true],
        ] as const)) {
      for (const type of ["success", "failure"] as const) {
        const result: ITtscCompilerTransformation = {
          type,
          typescript: {},
          diagnostics: [],
          graph: {
            edges: {},
            globals: [],
            configs: [],
            useCaseSensitiveFileNames: report,
          },
        };
        const selected = selectReportedMembershipPolicy(primed, result);
        assert.equal(selected.casePolicyLearned, expectedLearned);
        assert.deepEqual(selected.membershipPolicy, {
          excludedDirectories: [output],
          inputExtensions: [".ts", ".tsx"],
          sources: [config],
          useCaseSensitiveFileNames: report,
        });
        assert.equal(
          selected.membershipPolicy.excludedDirectories,
          primed.excludedDirectories,
        );
        assert.equal(
          selected.membershipPolicy.inputExtensions,
          primed.inputExtensions,
        );
        assert.equal(selected.membershipPolicy.sources, primed.sources);
      }
    }
    assert.equal(primed.useCaseSensitiveFileNames, primer);
  }
  const policy = {
    excludedDirectories: [],
    inputExtensions: [".ts"],
    sources: [],
  };
  const witnessed = new Set(["/types/first.d.ts", "/types/second.d.ts"]);
  const dependencies = [
    "/types/second.d.ts",
    "/types/third.d.ts",
    "/types/third.d.ts",
    "/types/../types/first.d.ts",
  ];
  const carried = carryTransformAttemptInputs(witnessed, true, {
    externalDependencyInputs: dependencies,
    membershipPolicy: { ...policy, useCaseSensitiveFileNames: false },
  });
  assert.deepEqual(
    [...carried.witnessed],
    [
      "/types/first.d.ts",
      "/types/second.d.ts",
      "/types/third.d.ts",
      "/types/../types/first.d.ts",
    ],
  );
  assert.equal(carried.useCaseSensitiveFileNames, false);
  assert.notEqual(carried.witnessed, witnessed);
  carried.witnessed.add("/next-attempt-only.d.ts");
  assert.deepEqual([...witnessed], ["/types/first.d.ts", "/types/second.d.ts"]);
  assert.deepEqual(dependencies, [
    "/types/second.d.ts",
    "/types/third.d.ts",
    "/types/third.d.ts",
    "/types/../types/first.d.ts",
  ]);
  for (const [prior, captured, expected] of [
    [undefined, undefined, undefined],
    [true, undefined, true],
    [false, undefined, false],
    [false, true, true],
    [true, false, false],
    [undefined, true, true],
    [undefined, false, false],
  ] as const) {
    for (const externalDependencyInputs of [undefined, []]) {
      const actual = carryTransformAttemptInputs(witnessed, prior, {
        externalDependencyInputs,
        membershipPolicy: { ...policy, useCaseSensitiveFileNames: captured },
      });
      assert.deepEqual(
        [...actual.witnessed],
        ["/types/first.d.ts", "/types/second.d.ts"],
      );
      assert.notEqual(actual.witnessed, witnessed);
      assert.equal(actual.useCaseSensitiveFileNames, expected);
    }
  }
}
