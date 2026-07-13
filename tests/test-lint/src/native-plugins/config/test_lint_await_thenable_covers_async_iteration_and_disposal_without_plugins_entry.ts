import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies await-thenable covers all three `await` syntax families in a real
 * no-plugin project: plain `await`, `for await...of`, and `await using`.
 *
 * This is the end-to-end reproduction from issue #413: a project whose tsconfig
 * carries NO `compilerOptions.plugins` entry activates `@ttsc/lint` purely
 * through package.json dependency auto-discovery and a discovered
 * `lint.config.json`. The rule historically visited only `await expression`
 * nodes, so the sync iterable in `for await...of` and the sync-only disposable
 * under `await using` sailed through while `await 42` reported. The fixture
 * keeps the three valid async controls (awaited Promise, async generator,
 * `Symbol.asyncDispose` resource) in the same file so an over-eager port that
 * blanket-bans the syntax families fails the exact-set assertion.
 *
 * 1. Materialize the issue's case file with a plugin-free tsconfig
 *    (`ESNext.Disposable` lib), a package.json depending on `@ttsc/lint`, and a
 *    discovered `lint.config.json` enabling only await-thenable.
 * 2. Run ttsc.
 * 3. Assert exactly three findings: `await 42`, the sync iterable, and the
 *    sync-only disposable, with every async control staying clean.
 */
export const test_lint_await_thenable_covers_async_iteration_and_disposal_without_plugins_entry =
  () => {
    const result = runLint({
      name: "await-thenable-no-plugins-entry",
      source: `async function run(): Promise<void> {
  await 42;

  for await (const value of [1, 2, 3]) {
    console.log(value);
  }

  await using resource = {
    [Symbol.dispose](): void {
      console.log("disposed");
    },
  };

  await Promise.resolve();

  for await (const value of (async function* (): AsyncGenerator<number> {
    yield 1;
  })()) {
    console.log(value);
  }

  await using asyncResource = {
    async [Symbol.asyncDispose](): Promise<void> {
      await Promise.resolve();
    },
  };

  console.log(resource, asyncResource);
}

export { run };
`,
      rules: { "typescript/await-thenable": "error" },
      extraSources: {
        // Overwrites the harness tsconfig: no `compilerOptions.plugins`
        // entry, so @ttsc/lint must activate through the package.json
        // dependency below. The lib list mirrors the issue's reproduction
        // (ESNext.Disposable provides Symbol.dispose / Symbol.asyncDispose).
        "tsconfig.json": JSON.stringify(
          {
            compilerOptions: {
              noEmit: true,
              strict: true,
              target: "ES2022",
              lib: ["ES2022", "DOM", "ESNext.Disposable"],
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
            name: "await-thenable-no-plugins-entry-fixture",
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
      [
        { rule: "typescript/await-thenable", severity: "error", line: 2 },
        { rule: "typescript/await-thenable", severity: "error", line: 4 },
        { rule: "typescript/await-thenable", severity: "error", line: 8 },
      ],
      result.stderr,
    );
  };
