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
 * --noEmit` afterward would add an independent checker invocation, so ttsc
 * must honor the lint descriptor's diagnostics capability. This probe does
 * not measure real compiler construction or total runtime cost.
 *
 * 1. Create a clean project with only `@ttsc/lint` as a check-stage plugin.
 * 2. Point `TTSC_TSGO_BINARY` at a fake tsgo that fails on build/check calls.
 * 3. Run `ttsc --noEmit` and assert success with no `--noEmit` tsgo call.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual clean lint checking succeeds with the selected controlled tsgo probe, which logs arguments and exits 99 on non-version calls; no recorded call contains --noEmit. A missing log is interpreted as the original empty invocation list, not proof that version discovery executed.
 * @evidence contracts/testing.md#independent-expectations The authored controlled probe exits 99 for unexpected checks; literal successful CLI status and prohibited --noEmit absence are independent expectations. The recorder witnesses only calls to this selected probe, not every compiler/process or checker construction.
 * @evidence contracts/testing.md#distinguishing-cases Owns clean noEmit with diagnostics capability and an instrumented plain-checker boundary, complementing simultaneous lint/compiler failure diagnostic suppression.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-ttsc export in the generic E2E population. The public CLI uses the actual workspace lint junction and a controlled plain-checker executable, not a packed installation or Linux-only selection claim.
 * @evidence contracts/e2e.md#necessary-boundary Native diagnostics capability must reach the launcher decision that omits a second plain tsgo process; direct predicate units cannot establish the actual descriptor and invocation connection.
 * @evidence contracts/e2e.md#shared-execution The unchanged lint producer and explicit suite-owned cache are available for reuse; the controlled checker/log are consumer-owned. Successful output does not independently certify a hit, preparation/process totals or minimum cost; real native lint remains the compiler-backed producer, not the recorder.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked consumer owns the checker script and initially absent invocation log. Child-specific executable/cache/PATH settings leave ambient state unchanged. Error, signal and status are checked before log consumption; synchronous return does not certify arbitrary descendants or loaded-image equality. No shared cache is deleted.
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
  assert.equal(fs.existsSync(logFile), false);
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

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
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
