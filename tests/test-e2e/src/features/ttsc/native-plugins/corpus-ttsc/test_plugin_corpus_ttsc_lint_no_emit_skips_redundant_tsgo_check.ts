import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint noEmit skips redundant tsgo check.
 *
 * `@ttsc/lint` loads the project Program and reports normal TypeScript
 * diagnostics during its `check` subcommand. Running a second plain `tsgo
 * --noEmit` afterward rebuilds the checker graph and doubles the expensive part
 * of lint benchmarks, so ttsc must trust the lint descriptor's diagnostics
 * capability instead of appending the guard.
 *
 * 1. Create a clean project with only `@ttsc/lint` as a check-stage plugin.
 * 2. Point `TTSC_TSGO_BINARY` at a fake tsgo that fails on build/check calls.
 * 3. Run `ttsc --noEmit` and assert success with no `--noEmit` tsgo call.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual clean lint checking succeeds while the tsgo probe records arguments and would fail any non-version invocation; the recorded calls contain no --noEmit check.
 * @evidence contracts/testing.md#independent-expectations The controlled probe exits 99 for unexpected checks, independently establishing that a second checker call would fail this run; explicit logged argument inspection checks the prohibited call.
 * @evidence contracts/testing.md#distinguishing-cases Owns clean noEmit with diagnostics capability and an instrumented plain-checker boundary, complementing simultaneous lint/compiler failure diagnostic suppression.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-ttsc export exercises the actual CLI, lint producer and subprocess admission in the shared Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary Native diagnostics capability must reach the launcher decision that omits a second plain tsgo process; direct predicate units cannot establish the actual descriptor and invocation connection.
 * @evidence contracts/e2e.md#shared-execution The lint producer shares the batch content-addressed cache; only the bounded tsgo probe and its invocation log are independent consumer inputs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fake tsgo and log belong to this isolated project, while the native lint producer stays real; probe state cannot leak into other consumers and no shared cache is deleted.
 * @evidence contracts/e2e.md#preserved-coverage Original successful status and negative --noEmit invocation assertion remain. The controlled plain checker is only an invocation witness, not a substitute for the actual lint compiler.
 */
export function test_plugin_corpus_ttsc_lint_no_emit_skips_redundant_tsgo_check(): void {
  const root = commonJsProject(
    FixtureFiles.read("ttsc/plugin_corpus_ttsc_lint_no_emit_skips_redundant_tsgo_check/inputs-1"),
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
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
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
}

function linkLintPackage(root: string): void {
  const scopeDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(scopeDir, { recursive: true });
  fs.symlinkSync(
    path.join(workspaceRoot, "packages", "lint"),
    path.join(scopeDir, "lint"),
    "junction",
  );
}
