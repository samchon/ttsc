import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies no-floating-promises enforces its scalar defaults through package
 * discovery without a compiler plugin entry.
 *
 * This is the consumer-real regression from issue #412: missing catch/then
 * handlers, finally, and Promise arrays report while a custom thenable stays
 * clean under the default `checkThenables: false` policy.
 *
 * 1. Materialize a plugin-free NodeNext project depending on `@ttsc/lint`.
 * 2. Enable only no-floating-promises and run the real ttsc launcher.
 * 3. Assert the exact four built-in-Promise diagnostics.
 */
export const test_lint_no_floating_promises_covers_defaults_without_plugins_entry =
  () => {
    const result = runLint({
      name: "no-floating-promises-no-plugins-entry",
      source: `Promise.reject(new Error("catch")).catch();
Promise.reject(new Error("finally")).finally(() => undefined);
Promise.resolve().then(undefined, undefined);
[Promise.resolve(1), Promise.resolve(2)];

interface CustomThenable {
  then(onFulfilled: () => void, onRejected: () => void): CustomThenable;
}
declare const customThenable: CustomThenable;
customThenable;

export {};
`,
      rules: { "typescript/no-floating-promises": "error" },
      extraSources: {
        "tsconfig.json": JSON.stringify(
          {
            compilerOptions: {
              noEmit: true,
              strict: true,
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
            },
            files: ["src/main.ts"],
          },
          null,
          2,
        ),
        "package.json": JSON.stringify(
          {
            name: "no-floating-promises-no-plugins-entry-fixture",
            private: true,
            dependencies: { "@ttsc/lint": "*" },
          },
          null,
          2,
        ),
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map(({ rule, severity, line }) => ({
        rule,
        severity,
        line,
      })),
      [1, 2, 3, 4].map((line) => ({
        rule: "typescript/no-floating-promises",
        severity: "error",
        line,
      })),
      result.stderr,
    );
  };
