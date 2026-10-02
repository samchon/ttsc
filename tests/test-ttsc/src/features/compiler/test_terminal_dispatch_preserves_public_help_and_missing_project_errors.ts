import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runTtsc } from "../../../../../packages/ttsc/src/launcher/internal/runTtsc";

/**
 * Verifies terminal output and early refusals through the source dispatcher.
 *
 * These requests print wrapper help or fail during admission or project
 * resolution, before any compiler can be selected. The captured streams belong
 * to the actual dispatcher, rather than a parser's predicted classification.
 *
 * 1. Require the public command and plugin help text with a successful status.
 * 2. Reject config listing, file listing and ordinary compilation in one real
 *    directory with no config above it.
 * 3. Reject unknown transform, fix/watch, four solution-build spellings and two
 *    truncated configs, retaining attributed errors and no outputs.
 * 4. Preserve the authored sentinel and restore both streams after all cases.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual runTtsc, printHelp, admission adapters and project resolver. Wrapper help requires status zero, empty stderr and literal public syntax/headings. ShowConfig, listFilesOnly and bare build require status two, empty stdout and exact missing-project stderr. Transform and fix/watch require exact errors. Four solution spellings require refusal, explicit-project advice, no TS6369 and no referenced outputs. Two truncated configs require independently specified comma-versus-closing-brace diagnostics with their config path and no dist/main.js. The sentinel stays unchanged.
 * @evidence contracts/testing.md#independent-expectations Public syntax and error literals define the interface. Authored config-free ancestry requires missing-project errors and supplies independent path attribution. Authored reference configs and valid sources begin without outputs; JSON ending after a value requires a comma while JSON ending after a trailing comma requires its closing brace, and both must reject before emission. The sentinel has independently authored bytes.
 * @evidence contracts/testing.md#distinguishing-cases Successful wrapper help contrasts with missing-project failures. Unknown command differs from admitted fix with invalid watch; leading/trailing build, short alias and check preserve solution admission. Two malformed configs contrast default and explicit emit. Independent collection retains all twelve requests. Native compiler help and init publication stay in the canonical E2E corpus.
 * @evidence contracts/testing.md#execution-ownership The unit TestExecutor calls this export and its synchronous owning dispatcher. Admission or project-read failures precede compiler selection; wrapper help calls no compiler. Actual source stdout/stderr writes are captured and restored in finally. No native process, product build or installed consumer is used.
 */
export function test_terminal_dispatch_preserves_public_help_and_missing_project_errors(): void {
  const allocated = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-terminal-source-"),
  );
  const root = fs.realpathSync(allocated);
  const writeOut = process.stdout.write;
  const writeError = process.stderr.write;
  const sentinel = path.join(root, "sentinel.txt");
  const sentinelBytes = "terminal source input remains unchanged\n";
  const failures: Error[] = [];
  let stdout = "";
  let stderr = "";
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout +=
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr +=
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stderr.write;
  try {
    for (let current = root; ; current = path.dirname(current)) {
      for (const name of ["tsconfig.json", "jsconfig.json"])
        assert.equal(
          fs.existsSync(path.join(current, name)),
          false,
          `resolver input has an ambient project: ${path.join(current, name)}`,
        );
      if (path.dirname(current) === current) break;
    }
    fs.writeFileSync(sentinel, sentinelBytes);
    const helpStatus = runTtsc(["--help"]);
    check("public wrapper help", () => {
      assert.equal(helpStatus, 0);
      assert.equal(stderr, "");
      assert.match(stdout, /standalone compiler adapter and plugin host/);
      for (const syntax of [
        "ttsc prepare [options]",
        "ttsc clean [options]",
        "ttsc fix [options]",
        "ttsc format [options]",
        "ttsc cache paths --json",
        "Plugin contract:",
      ])
        assert.equal(stdout.includes(syntax), true, syntax);
    });
    for (const argv of [["--showConfig"], ["--listFilesOnly"], []]) {
      stdout = stderr = "";
      const status = runTtsc(["--cwd", root, ...argv]);
      check(`missing project / ${argv[0] ?? "ordinary build"}`, () => {
        assert.equal(status, 2);
        assert.equal(stdout, "");
        assert.equal(
          stderr,
          `ttsc: could not find tsconfig.json or jsconfig.json starting from ${root}\n`,
        );
        assert.equal(fs.readFileSync(sentinel, "utf8"), sentinelBytes);
      });
    }
    for (const [argv, expected] of [
      [
        ["transform", "--cwd", root],
        'ttsc: unknown command "transform"\nttsc: run "ttsc --help" to see supported commands\n',
      ],
      [
        ["fix", "--watch", "--cwd", root],
        "ttsc: fix does not support watch mode; use ttsc --noEmit --watch for incremental checks\n",
      ],
    ] as const) {
      stdout = stderr = "";
      const status = runTtsc(argv);
      check(`dispatcher rejection / ${argv[0]}`, () => {
        assert.equal(status, 2);
        assert.equal(stdout, "");
        assert.equal(stderr, expected);
      });
    }
    const configPath = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        files: [],
        references: [{ path: "./pkg-a" }, { path: "./pkg-b" }],
      }),
    );
    for (const pkg of ["pkg-a", "pkg-b"]) {
      fs.mkdirSync(path.join(root, pkg, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(root, pkg, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: { composite: true, outDir: "dist", rootDir: "src" },
          include: ["src"],
        }),
      );
      fs.writeFileSync(
        path.join(root, pkg, "src", "index.ts"),
        "export const value = 1;\n",
      );
    }
    for (const argv of [
      ["--build", ".", "--cwd", root],
      ["--cwd", root, "--build"],
      ["-b", "--cwd", root],
      ["check", "--build", "--cwd", root],
    ]) {
      stdout = stderr = "";
      const status = runTtsc(argv);
      check(`solution admission / ${argv.join(" ")}`, () => {
        assert.equal(status, 2);
        assert.equal(stdout, "");
        assert.match(
          stderr,
          /ttsc: --build \(solution mode\) is not supported/,
        );
        assert.match(stderr, /ttsc -p <tsconfig>/);
        assert.doesNotMatch(
          stdout + stderr,
          /TS6369|must be the first command line argument/,
        );
        for (const pkg of ["pkg-a", "pkg-b"])
          assert.equal(fs.existsSync(path.join(root, pkg, "dist")), false);
      });
    }
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      'console.log("valid source");\n',
    );
    for (const [bytes, argv, punctuation] of [
      [
        '{ "compilerOptions": { "strict": true',
        [],
        /',' expected \(line 1 column \d+\)/,
      ],
      [
        '{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,',
        ["--emit"],
        /'\}' expected \(line 1 column \d+\)/,
      ],
    ] as const) {
      fs.writeFileSync(configPath, bytes);
      stdout = stderr = "";
      const status = runTtsc(["--cwd", root, ...argv]);
      check(`malformed configuration / ${argv[0] ?? "default"}`, () => {
        assert.equal(status, 2);
        assert.equal(stdout, "");
        assert.match(stderr, /ttsc: failed to parse /);
        assert.equal(stderr.includes(configPath), true);
        assert.match(stderr, punctuation);
        assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
        assert.equal(fs.readFileSync(sentinel, "utf8"), sentinelBytes);
      });
    }
  } finally {
    process.stdout.write = writeOut;
    process.stderr.write = writeError;
    fs.rmSync(allocated, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "terminal dispatcher source cases failed",
    );
}
