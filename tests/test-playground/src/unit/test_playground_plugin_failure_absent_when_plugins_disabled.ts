import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";

/**
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
