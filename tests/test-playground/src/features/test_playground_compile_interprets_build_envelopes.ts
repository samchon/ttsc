import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";

/**
 * Verifies compile and bundle turn every build envelope into exactly one
 * success, failure or error result with the right JavaScript and diagnostics.
 *
 * The worker interprets three independent facts: the process exit code, whether
 * a result payload exists and parses, and whether any diagnostic is an error.
 * A result with only warnings is a success, a result with an error diagnostic is
 * a failure that still carries the emitted JavaScript, and an envelope that
 * cannot be read or that crashed is an error whose message names the cause.
 *
 * 1. Return an error diagnostic with emitted JavaScript, with no emit, and with a
 *    nonzero exit code that still has a payload.
 * 2. Return only a warning, an empty payload and a payload without output.
 * 3. Return a nonzero exit code without a payload (with and without stderr),
 *    an unparseable payload, and a rejected build, for both compile and bundle.
 *
 * @evidence contracts/testing.md#behavioral-verification createWorkerCompilerService.compile and bundle return a failure with mapped diagnostics and the emitted JavaScript for an error diagnostic, a success for warnings or an empty payload, and an error carrying stderr, a fixed sentence or the rejection for an unreadable or crashed build. Complete deep-equal results reject a swapped type, a lost emit or a mapped diagnostic with the wrong coordinates.
 * @evidence contracts/testing.md#independent-expectations The expected diagnostics are hand-written from the authored source: the literal 'a' starts at byte 25 of `export const x: number = 'a';`, so the one-based column is 26 and the code is TS2322. The exit-code and payload conventions come from the documented compile result contract, not from the service.
 * @evidence contracts/testing.md#distinguishing-cases Error versus warning diagnostics, failure with and without emit, a nonzero exit with and without a payload, empty stderr against a stderr message, an unparseable payload and a thrown rejection are separate rows; compile and bundle repeat the matrix because they share one pipeline behind two tsconfig lanes.
 * @evidence contracts/testing.md#execution-ownership This entry owns every row's makeFakeWorker instance and calls the real createWorkerCompilerService with injected boot, API and host doubles in the unit process; no WASM runtime, Worker or compiler process runs. Plugin-failure handling is owned by the test_playground_plugin_failure_* entries.
 */
export const test_playground_compile_interprets_build_envelopes =
  async (): Promise<void> => {
    const source = "export const x: number = 'a';";
    const options = {
      ...BASE_OPTIONS,
      typiaPlugin: false as const,
      lintPlugin: false as const,
    };
    const typeError = {
      file: "/work/src/playground.ts",
      category: "error",
      code: 2322,
      messageText: "Type 'string' is not assignable to type 'number'.",
      start: 25,
      length: 3,
      line: 1,
      character: 26,
    };
    const mappedTypeError = {
      line: 1,
      column: 26,
      length: 3,
      severity: "error",
      message: "Type 'string' is not assignable to type 'number'.",
      code: "TS2322",
    };
    const unused = {
      file: "/work/src/playground.ts",
      category: "warning",
      code: 6133,
      messageText: "'x' is declared but never used.",
      start: 13,
      length: 1,
      line: 1,
      character: 14,
    };

    const rows: {
      name: string;
      build: () => ReturnType<typeof envelope>;
      expected: unknown;
    }[] = [
      {
        name: "error diagnostic keeps the emitted JavaScript",
        build: () =>
          envelope({
            code: 1,
            result: compilePayload(
              { "dist/src/playground.js": "export const x = 'a';" },
              [typeError],
            ),
          }),
        expected: {
          type: "failure",
          target: "javascript",
          value: "export const x = 'a';",
          diagnostics: [mappedTypeError],
        },
      },
      {
        name: "error diagnostic without any emit",
        build: () => envelope({ code: 1, result: compilePayload({}, [typeError]) }),
        expected: {
          type: "failure",
          target: "javascript",
          value: "",
          diagnostics: [mappedTypeError],
        },
      },
      {
        name: "warnings alone are a success",
        build: () =>
          envelope({
            result: compilePayload({ "dist/src/playground.js": "var x;" }, [
              unused,
            ]),
          }),
        expected: { type: "success", target: "javascript", value: "var x;" },
      },
      {
        name: "an empty payload emits nothing",
        build: () => envelope({ result: "{}" }),
        expected: { type: "success", target: "javascript", value: "" },
      },
      {
        name: "a payload without a JavaScript file emits nothing",
        build: () =>
          envelope({
            result: compilePayload({ "dist/src/playground.d.ts": "export {};" }),
          }),
        expected: { type: "success", target: "javascript", value: "" },
      },
      {
        name: "a nonzero exit without a payload reports stderr",
        build: () => envelope({ code: 1, stderr: "tsgo: out of memory" }),
        expected: {
          type: "error",
          target: "javascript",
          value: { message: "tsgo: out of memory" },
        },
      },
      {
        name: "a nonzero exit with neither payload nor stderr",
        build: () => envelope({ code: 1 }),
        expected: {
          type: "error",
          target: "javascript",
          value: { message: "ttsc: build failed without a result payload" },
        },
      },
      {
        name: "an unparseable payload",
        build: () => envelope({ code: 0, result: "<<<not json>>>" }),
        expected: {
          type: "error",
          target: "javascript",
          value: { message: "ttsc: result JSON could not be parsed" },
        },
      },
    ];

    const failures: unknown[] = [];
    for (const verb of ["compile", "bundle"] as const)
      for (const row of rows) {
        try {
          const { service, record } = makeFakeWorker(options, {
            build: row.build,
          });
          const result = await service[verb]({ source });
          assert.deepEqual(result, row.expected, `${verb}: ${row.name}`);
          assert.equal(record.build.length, 1, `${verb}: ${row.name} builds once`);
        } catch (error) {
          failures.push(error);
        }
      }

    for (const verb of ["compile", "bundle"] as const) {
      try {
        const { service } = makeFakeWorker(options, {
          build: () => {
            throw new Error("wasm runtime trapped");
          },
        });
        const result = await service[verb]({ source });
        assert.equal(result.type, "error", `${verb}: a rejected build errors`);
        assert.equal(result.target, "javascript");
        const value = result.value as { name: string; message: string };
        assert.equal(value.name, "Error");
        assert.equal(value.message, "wasm runtime trapped");
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Build envelope matrix failed");
  };
