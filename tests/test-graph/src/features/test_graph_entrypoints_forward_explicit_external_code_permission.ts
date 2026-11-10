import assert from "node:assert/strict";

import { TtscGraphLauncherArguments } from "../../../../packages/graph/src/TtscGraphLauncherArguments";
import { GraphArgumentError } from "../../../../packages/graph/src/launcherArgs";
import { TtscGraphNativeArguments } from "../../../../packages/graph/src/model/TtscGraphNativeArguments";

/**
 * Verifies every graph launcher preserves explicit compiler permission.
 *
 * An omitted option must retain existing defaults while explicit false can
 * withdraw inherited permission.
 *
 * 1. Parse omitted, enabled, disabled and repeated options in every lane.
 * 2. Require exact native vectors and detached publisher environment transport.
 * 3. Reject malformed boolean values before launching a producer.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls real launcher parsers and native argv builders, asserting optional-state preservation, true/false forwarding, last-option precedence and rejected input.
 * @evidence contracts/testing.md#independent-expectations Literal boolean values and native flag assignments define expected permission without deriving it from parser output.
 * @evidence contracts/testing.md#distinguishing-cases Covers omission, true, false, repetition, equals syntax and invalid values across MCP, viewer and dump grammar.
 * @evidence contracts/testing.md#execution-ownership The graph unit runner executes portable parsers and argv construction without a native process or consumer installation.
 */
export function test_graph_entrypoints_forward_explicit_external_code_permission(): void {
  const errors: unknown[] = [];
  for (const parse of [
    TtscGraphLauncherArguments.project,
    TtscGraphLauncherArguments.view,
    TtscGraphLauncherArguments.dump,
  ]) {
    for (const [args, expected] of [
      [[], undefined],
      [["--runExternalCode"], true],
      [["--runExternalCode=true"], true],
      [["--runExternalCode=false"], false],
      [["--runExternalCode", "--runExternalCode=false"], false],
    ] as const) {
      try {
        const options = parse(args) as { runExternalCode?: boolean };
        assert.equal(options.runExternalCode, expected);
        assert.equal(
          Object.hasOwn(options, "runExternalCode"),
          expected !== undefined,
        );
      } catch (error) {
        errors.push(error);
      }
    }
    assert.throws(() => parse(["--runExternalCode=maybe"]), GraphArgumentError);
  }
  if (errors.length !== 0)
    throw new AggregateError(errors, "permission parser cases failed");
  for (const permission of [undefined, true, false]) {
    const expected =
      permission === undefined ? [] : [`--runExternalCode=${permission}`];
    assert.deepEqual(
      TtscGraphNativeArguments.serve(
        "project root",
        "project.json",
        null,
        permission,
      ),
      [
        "serve",
        "--cwd",
        "project root",
        "--tsconfig",
        "project.json",
        ...expected,
      ],
    );
    const inherited = {
      TTSC_TSGO_ARGS: '["--strict","@relative.rsp","--runExternalCode","true"]',
      TTSC_TSGO_ARGS_CWD: "argument base",
      UNRELATED: "retained",
    };
    const environment = TtscGraphNativeArguments.environment(
      permission,
      inherited,
    );
    assert.notEqual(environment, inherited);
    assert.equal(environment.TTSC_TSGO_ARGS_CWD, "argument base");
    assert.equal(environment.UNRELATED, "retained");
    assert.deepEqual(JSON.parse(environment.TTSC_TSGO_ARGS!), [
      "--strict",
      "@relative.rsp",
      "--runExternalCode",
      "true",
      ...(permission === undefined
        ? []
        : ["--runExternalCode", String(permission)]),
    ]);
    assert.equal(
      inherited.TTSC_TSGO_ARGS,
      '["--strict","@relative.rsp","--runExternalCode","true"]',
    );
  }
  assert.deepEqual(
    TtscGraphLauncherArguments.dumpVector(["--runExternalCode=false"], null),
    ["dump", "--runExternalCode=false"],
  );
  for (const invalid of ["false", 0, null])
    assert.throws(
      () => TtscGraphNativeArguments.permission(invalid as unknown as boolean),
      /runExternalCode must be a boolean/,
    );
  for (const raw of ["{}", "[1]", "{"])
    assert.throws(() =>
      TtscGraphNativeArguments.environment(false, { TTSC_TSGO_ARGS: raw }),
    );
}
