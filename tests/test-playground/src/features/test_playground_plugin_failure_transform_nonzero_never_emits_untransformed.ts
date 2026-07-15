import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";

/**
 * A configured typia transform that exits nonzero must fail the build, never
 * silently fall through to compiling the original untransformed source.
 *
 * RA-03 (#664): both `compile` and `bundle` route the plugin envelope through
 * the same nonzero-code boundary the base `api.build` already used. The oracle
 * is the recorded `build` call count — a genuine failure means `api.build` is
 * never reached, so no JavaScript (transformed or not) can be emitted.
 *
 * 1. Transform verb resolves `{ code: 2 }`; both compile and bundle must return
 *    `type: "error"` and leave the build uninvoked (`record.build` empty).
 * 2. Negative twin: the same wiring with a `code: 0` transform whose payload
 *    rewrites the entry must succeed, invoke the build exactly once, and feed
 *    the build the rewritten text (proving the transform result is honored).
 */
export const test_playground_plugin_failure_transform_nonzero_never_emits_untransformed =
  async () => {
    const source = "export const x: number = 1;";

    // Direction: nonzero transform envelope → error, build skipped.
    for (const verb of ["compile", "bundle"] as const) {
      const { service, record } = makeFakeWorker(
        { ...BASE_OPTIONS, typiaPlugin: {}, lintPlugin: false },
        {
          plugin: () => envelope({ code: 2, stderr: "typia rule violation" }),
          build: () => envelope({ result: compilePayload({ "index.js": "1;" }) }),
        },
      );
      const result = await service[verb]({ source });
      assert.equal(
        result.type,
        "error",
        `${verb} must surface a failed transform as an error`,
      );
      assert.equal(
        record.build.length,
        0,
        `${verb} must not run the build after the transform failed`,
      );
      assert.match(
        String((result as { value: { message: string } }).value.message),
        /typia rule violation/,
      );
    }

    // Negative twin: successful transform → build runs once on rewritten text.
    const { service, record } = makeFakeWorker(
      { ...BASE_OPTIONS, typiaPlugin: {}, lintPlugin: false },
      {
        plugin: () =>
          envelope({
            code: 0,
            stdout: JSON.stringify({
              typescript: { "src/playground.ts": "export const x = 1; /*t*/" },
            }),
          }),
        build: () =>
          envelope({ result: compilePayload({ "src/playground.js": "x = 1;" }) }),
      },
    );
    const ok = await service.compile({ source });
    assert.equal(ok.type, "success", "valid transform must compile");
    assert.equal(ok.value, "x = 1;");
    assert.equal(record.build.length, 1, "successful transform builds once");
    assert.equal(
      record.writes["/work/src/playground.ts"],
      "export const x = 1; /*t*/",
      "the build must see the transform-rewritten entry source",
    );
  };
