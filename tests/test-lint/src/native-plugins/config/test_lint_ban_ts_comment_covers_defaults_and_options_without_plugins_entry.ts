import { assert, runLint } from "../../internal/config-file";

const NO_PLUGIN_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    strict: true,
    noEmit: true,
    rootDir: "src",
  },
  include: ["src"],
});

const PACKAGE_JSON = JSON.stringify({
  private: true,
  type: "module",
  dependencies: { "@ttsc/lint": "*" },
});

/**
 * Verifies `typescript/ban-ts-comment` reaches the real CLI through package
 * discovery, with no `compilerOptions.plugins` entry.
 *
 * The ordinary rule corpus uses `TestLint`, whose synthesized tsconfig names
 * `@ttsc/lint` explicitly. These two projects overwrite that tsconfig and add
 * only a direct package dependency, closing the consumer path required by
 * issue #415 while exercising both recommended defaults and every option arm.
 *
 * 1. Assert the scalar rule reports only default-forbidden `@ts-nocheck` while
 *    allowing a described `@ts-expect-error`.
 * 2. Assert the object form reports configured `@ts-check`, a description
 *    shorter than the configured minimum, and a format mismatch while allowing
 *    the matching and disabled directive arms.
 */
export const test_lint_ban_ts_comment_covers_defaults_and_options_without_plugins_entry =
  () => {
    const defaults = runLint({
      name: "ban-ts-comment-no-plugin-defaults",
      source: [
        "// @ts-nocheck",
        "const unchecked: string = 1;",
        "// @ts-expect-error: intentional mismatch",
        "const described: string = 1;",
        "",
      ].join("\n"),
      rules: { "typescript/ban-ts-comment": "error" },
      extraSources: {
        "tsconfig.json": NO_PLUGIN_TSCONFIG,
        "package.json": PACKAGE_JSON,
      },
    });

    assert.notEqual(defaults.status, 0, defaults.stderr);
    assert.deepEqual(
      defaults.diagnostics.map((d) => [d.rule, d.severity, d.line]),
      [["typescript/ban-ts-comment", "error", 1]],
      defaults.stderr,
    );

    const options = runLint({
      name: "ban-ts-comment-no-plugin-options",
      source: [
        "// @ts-check",
        "// @ts-nocheck: short",
        "const marker = 1;",
        "// @ts-expect-error: TS2322 because assignment is intentionally invalid",
        "const described: string = 1;",
        "// @ts-expect-error: wrong format but long enough",
        "const malformed: string = 1;",
        "// @ts-ignore",
        "const ignored: string = 1;",
        "void marker;",
        "",
      ].join("\n"),
      extraSources: {
        "lint.config.json": JSON.stringify({
          rules: {
            "typescript/ban-ts-comment": [
              "error",
              {
                minimumDescriptionLength: 10,
                "ts-check": true,
                "ts-nocheck": "allow-with-description",
                "ts-ignore": false,
                "ts-expect-error": {
                  descriptionFormat: "^: TS\\d+ because .+$",
                },
              },
            ],
          },
        }),
        "tsconfig.json": NO_PLUGIN_TSCONFIG,
        "package.json": PACKAGE_JSON,
      },
    });

    assert.notEqual(options.status, 0, options.stderr);
    assert.deepEqual(
      options.diagnostics.map((d) => [d.rule, d.severity, d.line]),
      [
        ["typescript/ban-ts-comment", "error", 1],
        ["typescript/ban-ts-comment", "error", 2],
        ["typescript/ban-ts-comment", "error", 6],
      ],
      options.stderr,
    );
  };
