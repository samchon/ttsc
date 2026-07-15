import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";

/**
 * Abnormal transform completions — a rejected plugin call and code-0 output
 * that cannot be parsed — are failures, not fall-throughs to an untransformed
 * build. A code-0 call with empty stdout is the boundary: it is a legitimate
 * "nothing to rewrite" success.
 *
 * RA-03 (#664): the pre-fix code caught rejections and parse errors and then
 * compiled the original source, reporting success. Each abnormal case must now
 * return `type: "error"` with the build never invoked.
 *
 * 1. `api.plugin` rejects → error, build skipped.
 * 2. Code 0 with non-JSON stdout → error (unusable configured transform).
 * 3. Boundary: code 0 with empty stdout → success, build runs once (no rewrite was
 *    produced, so the original source is compiled legitimately).
 */
export const test_playground_plugin_failure_transform_rejection_and_bad_output =
  async () => {
    const source = "export const x = 1;";
    const opts = {
      ...BASE_OPTIONS,
      typiaPlugin: {},
      lintPlugin: false,
    } as const;

    // 1. Rejected plugin call.
    {
      const { service, record } = makeFakeWorker(opts, {
        plugin: () => {
          throw new Error("wasm host crashed");
        },
        build: () => envelope({ result: compilePayload({ "index.js": "1;" }) }),
      });
      const result = await service.compile({ source });
      assert.equal(result.type, "error", "a rejected transform must error");
      assert.equal(
        record.build.length,
        0,
        "no build after a rejected transform",
      );
      assert.match(
        String((result as { value: { message: string } }).value.message),
        /wasm host crashed/,
      );
    }

    // 2. code 0 but unparseable transform output.
    {
      const { service, record } = makeFakeWorker(opts, {
        plugin: () => envelope({ code: 0, stdout: "<<<not json>>>" }),
        build: () => envelope({ result: compilePayload({ "index.js": "1;" }) }),
      });
      const result = await service.compile({ source });
      assert.equal(
        result.type,
        "error",
        "unparseable transform output must error",
      );
      assert.equal(record.build.length, 0, "no build after unusable output");
    }

    // 3. Boundary: code 0 with empty stdout is a legitimate no-op success.
    {
      const { service, record } = makeFakeWorker(opts, {
        plugin: () => envelope({ code: 0, stdout: "" }),
        build: () =>
          envelope({ result: compilePayload({ "src/playground.js": "x=1;" }) }),
      });
      const result = await service.compile({ source });
      assert.equal(result.type, "success", "empty transform output is a no-op");
      assert.equal(result.value, "x=1;");
      assert.equal(record.build.length, 1, "no-op transform still builds once");
    }
  };
