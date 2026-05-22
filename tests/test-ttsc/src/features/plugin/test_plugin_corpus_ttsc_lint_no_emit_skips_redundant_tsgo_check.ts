import { TestProject } from "@ttsc/testing";

import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint noEmit skips redundant tsgo check.
 *
 * `@ttsc/lint` loads the project Program and reports normal TypeScript
 * diagnostics during its `check` subcommand. Running a second plain
 * `tsgo --noEmit` afterward rebuilds the checker graph and doubles the
 * expensive part of lint benchmarks, so ttsc must trust the lint descriptor's
 * diagnostics capability instead of appending the guard.
 *
 * 1. Create a clean project with only `@ttsc/lint` as a check-stage plugin.
 * 2. Point `TTSC_TSGO_BINARY` at a fake tsgo that fails on build/check calls.
 * 3. Run `ttsc --noEmit` and assert success with no `--noEmit` tsgo call.
 */
export const test_plugin_corpus_ttsc_lint_no_emit_skips_redundant_tsgo_check =
  () => {
    const root = commonJsProject(
      {
        "lint.config.json": JSON.stringify({ rules: {} }),
        "package.json": JSON.stringify({ private: true }),
        "src/main.ts": `export const value: string = "lint";\n`,
      },
      {
        compilerOptions: {
          plugins: [
            {
              configFile: "./lint.config.json",
              transform: "@ttsc/lint",
            },
          ],
        },
      },
    );
    linkLintPackage(root);

    const logFile = path.join(root, "tsgo-invocations.jsonl");
    const fakeTsgo = path.join(root, "fake-tsgo.js");
    fs.writeFileSync(
      fakeTsgo,
      [
        "#!/usr/bin/env node",
        'const fs = require("node:fs");',
        `const logFile = ${JSON.stringify(logFile)};`,
        "const args = process.argv.slice(2);",
        'fs.appendFileSync(logFile, JSON.stringify(args) + "\\n", "utf8");',
        'if (args.includes("--version")) {',
        '  console.log("Version 7.0.0-dev.FAKE");',
        "  process.exit(0);",
        "}",
        'console.error("unexpected tsgo invocation " + JSON.stringify(args));',
        "process.exit(99);",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.chmodSync(fakeTsgo, 0o755);

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-lint-noemit-"),
        TTSC_TSGO_BINARY: fakeTsgo,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    const invocations = fs.existsSync(logFile)
      ? fs
          .readFileSync(logFile, "utf8")
          .trim()
          .split(/\r?\n/)
          .filter((line) => line.length !== 0)
          .map((line) => JSON.parse(line) as string[])
      : [];
    assert.equal(
      invocations.some((args) => args.includes("--noEmit")),
      false,
      JSON.stringify(invocations),
    );
  };

function linkLintPackage(root: string): void {
  const scopeDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(scopeDir, { recursive: true });
  fs.symlinkSync(
    path.join(workspaceRoot, "packages", "lint"),
    path.join(scopeDir, "lint"),
    "junction",
  );
}
