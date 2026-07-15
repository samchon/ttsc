import assert from "node:assert/strict";

import { BASE_OPTIONS, envelope, makeFakeWorker } from "../internal/fakeWorker";

/**
 * A lint plugin that fails to run must stay visible; it can never collapse into
 * an empty (clean) diagnostic list. A lint run that *completed* — even with a
 * nonzero exit because it found violations — reports its parsed findings
 * unchanged.
 *
 * RA-03 (#664): the pre-fix lint path always parsed stderr and its catch branch
 * returned `{ diagnostics: [] }`, so a crashed or nonzero-with-no-output plugin
 * looked identical to a clean file.
 *
 * 1. code 2 whose stderr yields no parseable diagnostic → exactly one error
 *    diagnostic (a surfaced failure, not an empty clean result).
 * 2. Rejected plugin call → exactly one error diagnostic.
 * 3. Negative twin: code 2 whose stderr parses into a real finding → that
 *    finding is preserved, not replaced by a generic failure.
 * 4. Boundary: code 0 with empty stderr → genuinely clean empty result.
 */
export const test_playground_plugin_failure_lint_never_reports_false_clean =
  async () => {
    const source = "export const x = 1;\n";
    const opts = { ...BASE_OPTIONS, lintPlugin: {} } as const;

    // 1. Nonzero exit, no parseable diagnostic → surfaced failure.
    {
      const { service } = makeFakeWorker(opts, {
        plugin: () => envelope({ code: 2, stderr: "panic: lint host exploded" }),
      });
      const { diagnostics } = await service.lint({ source });
      assert.equal(diagnostics.length, 1, "a failed lint must not look clean");
      assert.equal(diagnostics[0]?.severity, "error");
    }

    // 2. Rejected call → surfaced failure.
    {
      const { service } = makeFakeWorker(opts, {
        plugin: () => {
          throw new Error("worker terminated");
        },
      });
      const { diagnostics } = await service.lint({ source });
      assert.equal(diagnostics.length, 1, "a rejected lint must not look clean");
      assert.match(String(diagnostics[0]?.message), /worker terminated/);
    }

    // 3. Negative twin: a completed linter's real findings survive intact.
    {
      const { service } = makeFakeWorker(opts, {
        plugin: () =>
          envelope({
            code: 2,
            stderr:
              "src/playground.ts:1:14 - error TS9001: [no-magic] avoid literals\n",
          }),
      });
      const { diagnostics } = await service.lint({ source });
      assert.equal(diagnostics.length, 1, "the parsed finding is preserved");
      assert.equal(diagnostics[0]?.line, 1);
      assert.equal(diagnostics[0]?.column, 14);
      assert.equal(diagnostics[0]?.code, "TS9001");
      assert.match(String(diagnostics[0]?.message), /no-magic/);
    }

    // 4. Boundary: a completed clean run is genuinely empty.
    {
      const { service } = makeFakeWorker(opts, {
        plugin: () => envelope({ code: 0, stderr: "" }),
      });
      const { diagnostics } = await service.lint({ source });
      assert.equal(diagnostics.length, 0, "a clean lint is legitimately empty");
    }
  };
