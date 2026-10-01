import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";

/**
 * Verifies a disabled plugin lane is never invoked or surfaced as a failure.
 *
 * Explicit plugin disabling (`typiaPlugin: false`, `lintPlugin: false`) must be
 * preserved: the failure-surfacing logic only runs for a _configured_ plugin. A
 * disabled plugin is never invoked, so a would-be failing envelope can never
 * turn a disabled lane into an error or a diagnostic.
 *
 * RA-03 (#664): this is the negative twin of the failure-surfacing behavior —
 * it proves the new nonzero-envelope handling is gated on plugin configuration,
 * not applied unconditionally.
 *
 * 1. `typiaPlugin: false` → compile never calls the plugin and builds the source
 *    directly to a success.
 * 2. `lintPlugin: false` → lint returns an empty result without calling the
 *    plugin, even though the wired handler would resolve a nonzero envelope.
 *
 * @evidence contracts/testing.md#behavioral-verification createWorkerCompilerService.compile/lint honor disabled typia/lint options: direct compilation returns literalx=1;, lint is empty and a wired failing plugin is never called.
 * @evidence contracts/testing.md#independent-expectations Independent makeFakeWorker call logs require plugin0/build1 and authored emitted JSx=1; distinguishes successful direct compilation from invented empty success.
 * @evidence contracts/testing.md#distinguishing-cases Two disabled lanes contrast with a populated plugin handler that would fail if invoked; configured-plugin failures remain owned by neighboring failure cases.
 * @evidence contracts/testing.md#execution-ownership This entry calls the real service through makeFakeWorker, whose injected boot/API/host record operations without WASM boot or a Worker; the compile and lint assertions belong to this named source unit.
 */
export const test_playground_plugin_failure_absent_when_plugins_disabled =
  async () => {
    const source = "export const x = 1;";

    const { service, record } = makeFakeWorker(
      { ...BASE_OPTIONS, typiaPlugin: false, lintPlugin: false },
      {
        plugin: () => envelope({ code: 2, stderr: "should never be called" }),
        build: () =>
          envelope({ result: compilePayload({ "src/playground.js": "x=1;" }) }),
      },
    );

    const compiled = await service.compile({ source });
    assert.equal(compiled.type, "success", "disabled typia compiles directly");
    assert.equal(compiled.value, "x=1;");

    const lint = await service.lint({ source });
    assert.deepEqual(
      lint.diagnostics,
      [],
      "disabled lint returns an empty result",
    );

    assert.equal(
      record.plugin.length,
      0,
      "no plugin verb runs when both plugins are disabled",
    );
    assert.equal(record.build.length, 1, "only the direct build ran");
  };
