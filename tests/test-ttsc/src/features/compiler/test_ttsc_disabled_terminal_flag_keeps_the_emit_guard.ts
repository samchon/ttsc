import fs from "node:fs";
import path from "node:path";

import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `--showConfig false` keeps ttsc's emit guard around a failing build.
 *
 * TypeScript-Go reads `--showConfig false` as an ordinary compile. ttsc used to
 * classify the flag by presence alone, treat the build as a print-and-exit
 * command, and drop its `--noEmitOnError` guard, so a project with a type error
 * failed yet still wrote JavaScript. The effective value, not the spelling,
 * decides whether a terminal flag is in effect.
 *
 * 1. Create a project with a type error and no native plugins.
 * 2. Run `ttsc --showConfig false`, then `ttsc --showConfig false --showConfig
 *    true`.
 * 3. Assert the first fails without emitting, and the second prints the config
 *    because the last occurrence wins.
 *
 * @evidence contracts/testing.md#behavioral-verification A broken program with --showConfig false must fail TS2322 and emit no JS; appending --showConfig true must instead succeed, print compilerOptions and still emit no JS. This catches presence-only terminal classification bypassing the failure emit guard.
 * @evidence contracts/testing.md#independent-expectations Literal number-to-string source requires TS2322 for an actual compile, while effective showConfig true prints config rather than compiling. Explicit last-wins arguments, diagnostic code, config text and fresh output absence independently pin those effects.
 * @evidence contracts/testing.md#distinguishing-cases Disabled terminal flag forces ordinary guarded compilation; reenabled last occurrence chooses terminal config printing despite the same invalid source. The unflagged semantic-gate entry provides the ordinary forced-emit failure baseline.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_disabled_terminal_flag_keeps_the_emit_guard in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by TestSourceUnits.
 * @evidence contracts/e2e.md#necessary-boundary The real launcher terminal profile determines actual native check/print behavior and emitted files. Parser units alone cannot prove a false terminal value retains noEmitOnError around native compilation.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams. Both commands share the same broken consumer but use separate exited children because effective terminal behavior changes. No native plugin installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_disabled_terminal_flag_keeps_the_emit_guard. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_disabled_terminal_flag_keeps_the_emit_guard = () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const value: string = 1;\n`,
  });

  const disabled = spawn(ttscBin, ["--cwd", root, "--showConfig", "false"], {
    cwd: root,
  });
  assert.notEqual(disabled.status, 0, disabled.stdout);
  assert.match(disabled.stdout + disabled.stderr, /TS2322/);
  assert.equal(
    fs.existsSync(path.join(root, "dist", "main.js")),
    false,
    "a failed build with a disabled terminal flag must not emit",
  );

  const reenabled = spawn(
    ttscBin,
    ["--cwd", root, "--showConfig", "false", "--showConfig", "true"],
    { cwd: root },
  );
  assert.equal(reenabled.status, 0, reenabled.stderr);
  assert.match(reenabled.stdout, /"compilerOptions"/);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
};
