import { TestProject } from "@ttsc/testing";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { computeCacheKey } from "../../../../../../packages/ttsc/lib/plugin/internal/source/computeCacheKey.js";
import { spawnGoTool as actualSpawnGoTool } from "../../../../../../packages/ttsc/lib/plugin/internal/source/spawnGoTool.js";
import { assert, fs, path } from "../../../internal/ttsc/internal/source-build";
/**
 * Verifies native executable lookup and Windows wrapper argv in one OS corpus.
 *
 * One temporary root owns the original capture wrapper, hostile and alternate
 * lookup spellings, compiler-identity files and native missing-process
 * reference. These are actual OS launches and missing-process observations, not
 * Go compiler builds or successful metadata answers from a Go toolchain.
 *
 * 1. Deliver the original Windows argv/environment/search matrix to Node capture.
 * 2. Retain native precedence, parent-versus-child cwd policy and tool identities.
 * 3. Compare every missing tool spelling with independent Node ENOENT fields.
 * 4. Collect all reached assertion failures before failing the complete round.
 * 5. Close the round by removing only its verified owned temporary root.
 *
 * Returned direct request receipts are observations. Nested metadata counts
 * remain a reviewed callee plan. A failed prerequisite marks the report BLOCKED;
 * incomplete groups never claim full coverage.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual spawnGoTool preserves every original wrapper argv/environment and executable lookup assertion, distinguishes relative/extended tool identities and matches native missing-process fields.
 * @evidence contracts/testing.md#independent-expectations Authored command arrays and a separate Node capture script establish argv expectations; native spawnSync of an absent executable independently supplies errno and pid.
 * @evidence contracts/testing.md#distinguishing-cases Hostile Windows tokens, PATH whitespace/semicolon/casing, native precedence, cwd parent/child policy and all original missing spellings remain. The wrapper matrix is Windows-only and POSIX does not claim it executed.
 * @evidence contracts/testing.md#execution-ownership One named E2E owner runs both original matrices from one shared temporary root. The portable command plan remains in its existing source unit; this entry owns actual native OS lookup, cmd delivery and missing-process behavior.
 * @evidence contracts/e2e.md#necessary-boundary Node's actual spawn behavior and cmd expansion cannot be established by an argument formatter. Captured argv, native selection sentinels and native ENOENT fields independently observe this OS boundary.
 * @evidence contracts/e2e.md#shared-execution The Windows capture fixture and missing-process matrix share one root and process. Original OS request vectors remain separate calls; no Go compiler is built or invoked, and metadata requests in the identity assertions run the original capture/native fixtures.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The one TestProject root isolates wrappers, capture, native template copies and source identity files. All original ambient PATH/cwd-policy writes retain their finally restoration, and the missing matrix uses names absent from that shared root.
 * @evidence contracts/e2e.md#preserved-coverage Both complete original bodies retain every authored argument, error field, environment sentinel, key distinction and capability branch. Two independent temporary roots become one; original named entries remain until this full corpus is verified.
 */
export function test_native_go_tool_os_corpus_preserves_wrapper_and_missing_process_boundaries(): void {
  const failures: Error[] = [];
  const attempts: Array<{
    binary: string;
    args: readonly string[];
    cwd: string | URL | undefined;
  }> = [];
  let nativeReferenceAttempted = false;
  let cleanupCompleted = false;
  const receipts: Array<{
    binary: string;
    args: readonly string[];
    status: number | null;
    pid: number;
    missing: boolean;
    syntheticMissingCandidate: boolean;
  }> = [];
  let operation = "fixture setup";
  const collectOsAssertion = (verify: () => void, identity: string): void => {
    try {
      verify();
    } catch (cause) {
      failures.push(new Error(identity + ": " + operation, { cause }));
    }
  };
  const spawnGoTool: typeof actualSpawnGoTool = (binary, args, options) => {
    operation = JSON.stringify({ binary, args, cwd: options.cwd });
    attempts.push({ binary, args: [...args], cwd: options.cwd });
    const result = actualSpawnGoTool(binary, args, options);
    const missing =
      (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
    receipts.push({
      binary,
      args: [...args],
      status: result.status,
      pid: result.pid,
      missing,
      syntheticMissingCandidate:
        process.platform === "win32" &&
        missing &&
        /\.(?:cmd|bat)$/i.test(binary),
    });
    return result;
  };
  let wrapperMatrixFinished = process.platform !== "win32";
  let nativeMissingMatrixFinished = false;
  const root = TestProject.tmpdir("ttsc-go-tool-os-corpus-");
  try {
    try {
      if (process.platform === "win32") {
        const wrapperRoot = path.join(
          root,
          "%TTSC_GO_EXPANDS% literal %% & (parentheses) ^ caret !TTSC_GO_DELAYED!",
        );
        fs.mkdirSync(wrapperRoot, { recursive: true });
        const capture = path.join(root, "argv.jsonl");
        const script = path.join(wrapperRoot, "capture.cjs");
        fs.writeFileSync(
          script,
          [
            'const fs = require("node:fs");',
            "fs.appendFileSync(",
            "  process.env.TTSC_GO_ARGV_CAPTURE,",
            "  JSON.stringify({",
            "    args: process.argv.slice(2),",
            "    sentinel: process.env.TTSC_GO_CALLER_SENTINEL,",
            '  }) + "\\n",',
            '  "utf8",',
            ");",
            "",
          ].join("\n"),
          "utf8",
        );
        const wrapper = path.join(wrapperRoot, "go.cmd");
        fs.writeFileSync(
          wrapper,
          `@echo off\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
          "utf8",
        );
        const commands = [
          ["version"],
          [
            "env",
            "-json",
            "GOOS",
            "%SET_VALUE%",
            "%%",
            "%",
            "%UNKNOWN%",
            "!SET_VALUE!",
            "!",
            "!UNKNOWN!",
          ],
          ["mod", "edit", "-json", "space value", "&", "(value)", "^"],
          [
            "build",
            "-o",
            path.join(wrapperRoot, '%OUTPUT% & "quoted" \\'),
            ".",
          ],
        ];
        const env: NodeJS.ProcessEnv = {
          ...process.env,
          TTSC_GO_ARGV_CAPTURE: capture,
          TTSC_GO_CALLER_SENTINEL: "preserved",
          TTSC_GO_DELAYED: "WRONG_DIRECTORY",
          TTSC_GO_EXPANDS: "WRONG_DIRECTORY",
          TTSC_GO_TEST_NODE: process.execPath,
          SET_VALUE: "WRONG_ARGUMENT",
        };
        for (const args of commands) {
          const result = spawnGoTool(wrapper, args, {
            encoding: "utf8",
            env,
            windowsHide: true,
          });
          collectOsAssertion(
            () =>
              assert.equal(
                result.status,
                0,
                result.stderr || result.error?.message,
              ),
            "original OS assertion line 94",
          );
        }
        const lookupArgs = ["env", "PATH lookup", "%LOOKUP%", "!LOOKUP!"];
        const lookupResult = spawnGoTool("go", lookupArgs, {
          cwd: root,
          encoding: "utf8",
          env: { ...env, PATH: wrapperRoot, PATHEXT: ".EXE;.CMD" },
          windowsHide: true,
        });
        collectOsAssertion(
          () =>
            assert.equal(
              lookupResult.status,
              0,
              lookupResult.stderr || lookupResult.error?.message,
            ),
          "original OS assertion line 104",
        );
        const relativeArgs = ["version", "relative wrapper"];
        const relativeResult = spawnGoTool(".\\go.cmd", relativeArgs, {
          cwd: wrapperRoot,
          encoding: "utf8",
          env,
          windowsHide: true,
        });
        collectOsAssertion(
          () =>
            assert.equal(
              relativeResult.status,
              0,
              relativeResult.stderr || relativeResult.error?.message,
            ),
          "original OS assertion line 117",
        );
        const whitespaceRoot = path.join(root, " leading-path-entry");
        fs.mkdirSync(whitespaceRoot, { recursive: true });
        fs.copyFileSync(script, path.join(whitespaceRoot, "capture.cjs"));
        fs.copyFileSync(wrapper, path.join(whitespaceRoot, "go.cmd"));
        const whitespaceArgs = ["version", "literal PATH whitespace"];
        const whitespaceResult = spawnGoTool("go", whitespaceArgs, {
          cwd: root,
          encoding: "utf8",
          env: { ...env, PATH: " leading-path-entry", PATHEXT: ".CMD" },
          windowsHide: true,
        });
        collectOsAssertion(
          () =>
            assert.equal(
              whitespaceResult.status,
              0,
              whitespaceResult.stderr || whitespaceResult.error?.message,
            ),
          "original OS assertion line 134",
        );
        const semicolonRoot = path.join(root, "quoted;path-entry");
        fs.mkdirSync(semicolonRoot, { recursive: true });
        fs.copyFileSync(script, path.join(semicolonRoot, "capture.cjs"));
        fs.copyFileSync(wrapper, path.join(semicolonRoot, "go.cmd"));
        const semicolonArgs = ["version", "quoted semicolon PATH"];
        const semicolonResult = spawnGoTool("go", semicolonArgs, {
          cwd: root,
          encoding: "utf8",
          env: { ...env, PATH: `"${semicolonRoot}"`, PATHEXT: ".CMD" },
          windowsHide: true,
        });
        collectOsAssertion(
          () =>
            assert.equal(
              semicolonResult.status,
              0,
              semicolonResult.stderr || semicolonResult.error?.message,
            ),
          "original OS assertion line 151",
        );
        const singleQuoteArgs = ["version", "single-quoted semicolon PATH"];
        const singleQuoteResult = spawnGoTool("go", singleQuoteArgs, {
          cwd: root,
          encoding: "utf8",
          env: { ...env, PATH: `'${semicolonRoot}'`, PATHEXT: ".CMD" },
          windowsHide: true,
        });
        collectOsAssertion(
          () =>
            assert.equal(
              singleQuoteResult.status,
              0,
              singleQuoteResult.stderr || singleQuoteResult.error?.message,
            ),
          "original OS assertion line 163",
        );
        fs.copyFileSync(wrapper, path.join(wrapperRoot, "node.cmd"));
        const nativeMarker = path.join(root, "native-selected.txt");
        const nativeResult = spawnGoTool(
          "node",
          [
            "-e",
            'require("node:fs").writeFileSync(process.env.TTSC_GO_NATIVE_MARKER, "native")',
          ],
          {
            cwd: wrapperRoot,
            encoding: "utf8",
            env: {
              ...env,
              PATH: path.dirname(process.execPath),
              PATHEXT: ".CMD;.EXE",
              TTSC_GO_NATIVE_MARKER: nativeMarker,
            },
            windowsHide: true,
          },
        );
        collectOsAssertion(
          () =>
            assert.equal(
              nativeResult.status,
              0,
              nativeResult.stderr || nativeResult.error?.message,
            ),
          "original OS assertion line 189",
        );
        collectOsAssertion(
          () => assert.equal(fs.readFileSync(nativeMarker, "utf8"), "native"),
          "original OS assertion line 194",
        );
        const blockedRoot = path.join(root, "blocked-current-directory");
        fs.mkdirSync(blockedRoot, { recursive: true });
        fs.writeFileSync(path.join(blockedRoot, "go.cmd"), "@exit /b 91\r\n");
        const noCwdArgs = ["version", "skip current directory"];
        const noDefaultCurrentDirectory =
          process.env.NoDefaultCurrentDirectoryInExePath;
        try {
          delete process.env.NoDefaultCurrentDirectoryInExePath;
          const childPolicyResult = spawnGoTool("go", ["version"], {
            cwd: blockedRoot,
            encoding: "utf8",
            env: {
              ...env,
              NoDefaultCurrentDirectoryInExePath: "1",
              PATH: `"${semicolonRoot}"`,
              PATHEXT: ".CMD",
            },
            windowsHide: true,
          });
          collectOsAssertion(
            () =>
              assert.equal(
                childPolicyResult.status,
                91,
                "the child environment must not disable libuv's parent cwd probe",
              ),
            "original OS assertion line 215",
          );
          process.env.NoDefaultCurrentDirectoryInExePath = "1";
          const noCwdResult = spawnGoTool("go", noCwdArgs, {
            cwd: blockedRoot,
            encoding: "utf8",
            env: {
              ...env,
              PATH: `"${semicolonRoot}"`,
              PATHEXT: ".CMD",
            },
            windowsHide: true,
          });
          collectOsAssertion(
            () =>
              assert.equal(
                noCwdResult.status,
                0,
                noCwdResult.stderr || noCwdResult.error?.message,
              ),
            "original OS assertion line 232",
          );
          const quotedEmptyResult = spawnGoTool("go", ["version"], {
            cwd: blockedRoot,
            encoding: "utf8",
            env: {
              ...env,
              PATH: `"";"${semicolonRoot}"`,
              PATHEXT: ".CMD",
            },
            windowsHide: true,
          });
          collectOsAssertion(
            () =>
              assert.equal(
                quotedEmptyResult.status,
                91,
                "a quoted-empty PATH entry must explicitly select cwd",
              ),
            "original OS assertion line 247",
          );
        } finally {
          if (noDefaultCurrentDirectory === undefined) {
            delete process.env.NoDefaultCurrentDirectoryInExePath;
          } else {
            process.env.NoDefaultCurrentDirectoryInExePath =
              noDefaultCurrentDirectory;
          }
        }
        const envWithoutPath: NodeJS.ProcessEnv = { ...env, PATHEXT: ".CMD" };
        for (const key of Object.keys(envWithoutPath)) {
          if (key.toLowerCase() === "path") delete envWithoutPath[key];
        }
        const parentPath = process.env.PATH;
        const inheritedPathArgs = ["version", "inherited PATH"];
        try {
          process.env.PATH = whitespaceRoot;
          const inheritedPathResult = spawnGoTool("go", inheritedPathArgs, {
            cwd: root,
            encoding: "utf8",
            env: envWithoutPath,
            windowsHide: true,
          });
          collectOsAssertion(
            () =>
              assert.equal(
                inheritedPathResult.status,
                0,
                inheritedPathResult.stderr ||
                  inheritedPathResult.error?.message,
              ),
            "original OS assertion line 275",
          );
        } finally {
          if (parentPath === undefined) delete process.env.PATH;
          else process.env.PATH = parentPath;
        }
        const duplicatePathArgs = ["version", "duplicate PATH casing"];
        const duplicatePathResult = spawnGoTool("go", duplicatePathArgs, {
          cwd: root,
          encoding: "utf8",
          env: {
            ...envWithoutPath,
            Path: `"${semicolonRoot}"`,
            path: blockedRoot,
          },
          windowsHide: true,
        });
        collectOsAssertion(
          () =>
            assert.equal(
              duplicatePathResult.status,
              0,
              duplicatePathResult.stderr || duplicatePathResult.error?.message,
            ),
          "original OS assertion line 296",
        );
        const plugin = path.join(root, "plugin");
        const relativeToolchainA = path.join(plugin, "relative-toolchain-a");
        const relativeToolchainB = path.join(plugin, "relative-toolchain-b");
        fs.mkdirSync(relativeToolchainA, { recursive: true });
        fs.mkdirSync(relativeToolchainB, { recursive: true });
        fs.writeFileSync(
          path.join(plugin, "go.mod"),
          "module example.com/plugin\n\ngo 1.26\n",
          "utf8",
        );
        fs.writeFileSync(
          path.join(plugin, "main.go"),
          "package main\n",
          "utf8",
        );
        for (const toolchain of [relativeToolchainA, relativeToolchainB]) {
          fs.copyFileSync(script, path.join(toolchain, "capture.cjs"));
        }
        fs.writeFileSync(
          path.join(relativeToolchainA, "go.cmd"),
          `@echo off\r\nrem compiler a\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
          "utf8",
        );
        fs.writeFileSync(
          path.join(relativeToolchainB, "go.cmd"),
          `@echo off\r\nrem compiler b\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
          "utf8",
        );
        const keyA = computeCacheKey({
          dir: plugin,
          entry: ".",
          env: {
            ...env,
            PATH: "relative-toolchain-a",
            PATHEXT: ".CMD",
          },
          goBinary: "go",
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
        const keyB = computeCacheKey({
          dir: plugin,
          entry: ".",
          env: {
            ...env,
            PATH: "relative-toolchain-b",
            PATHEXT: ".CMD",
          },
          goBinary: "go",
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
        collectOsAssertion(
          () => assert.notEqual(keyA, keyB),
          "original OS assertion line 350",
        );
        const nativeTemplate = path.join(
          process.env.SystemRoot ?? "C:\\Windows",
          "System32",
          "where.exe",
        );
        const extendedNativeA = path.join(root, "extended-native-a");
        const extendedNativeB = path.join(root, "extended-native-b");
        fs.mkdirSync(extendedNativeA, { recursive: true });
        fs.mkdirSync(extendedNativeB, { recursive: true });
        const goV1A = path.join(extendedNativeA, "go.v1.exe");
        const goV1B = path.join(extendedNativeB, "go.v1.exe");
        fs.copyFileSync(nativeTemplate, goV1A);
        fs.copyFileSync(nativeTemplate, goV1B);
        fs.appendFileSync(goV1A, "compiler a");
        fs.appendFileSync(goV1B, "compiler b");
        const extendedKeyA = computeCacheKey({
          dir: plugin,
          entry: ".",
          env: { ...env, PATH: extendedNativeA },
          goBinary: "go.v1",
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
        const extendedKeyB = computeCacheKey({
          dir: plugin,
          entry: ".",
          env: { ...env, PATH: extendedNativeB },
          goBinary: "go.v1",
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
        collectOsAssertion(
          () => assert.notEqual(extendedKeyA, extendedKeyB),
          "original OS assertion line 383",
        );
        for (const missing of [
          "missing-go",
          "missing-go.cmd",
          ".\\missing-go.cmd",
        ]) {
          const result = spawnGoTool(missing, ["version"], {
            cwd: root,
            encoding: "utf8",
            env: { ...env, PATH: root, PATHEXT: ".CMD" },
            windowsHide: true,
          });
          collectOsAssertion(
            () =>
              assert.equal(
                (result.error as NodeJS.ErrnoException | undefined)?.code,
                "ENOENT",
              ),
            "original OS assertion line 396",
          );
        }
        operation = "capture transcript and caller environment";
        const captured = fs
          .readFileSync(capture, "utf8")
          .trim()
          .split(/\r?\n/)
          .map(
            (line) =>
              JSON.parse(line) as {
                args: string[];
                sentinel: string | undefined;
              },
          );
        const expectedArgs = [
          ...commands,
          lookupArgs,
          relativeArgs,
          whitespaceArgs,
          semicolonArgs,
          singleQuoteArgs,
          noCwdArgs,
          inheritedPathArgs,
          duplicatePathArgs,
        ];
        collectOsAssertion(
          () =>
            assert.deepEqual(
              captured.slice(0, expectedArgs.length).map(({ args }) => args),
              expectedArgs,
            ),
          "original OS assertion line 421",
        );
        collectOsAssertion(
          () => assert.equal(captured.length, expectedArgs.length + 4),
          "original OS assertion line 425",
        );
        for (
          let index = expectedArgs.length;
          index < captured.length;
          index += 2
        ) {
          collectOsAssertion(
            () => assert.deepEqual(captured[index]?.args, ["version"]),
            "original OS assertion line 427",
          );
          collectOsAssertion(
            () =>
              assert.deepEqual(captured[index + 1]?.args.slice(0, 2), [
                "env",
                "-json",
              ]),
            "original OS assertion line 428",
          );
        }
        collectOsAssertion(
          () =>
            assert.ok(
              captured.every(({ sentinel }) => sentinel === "preserved"),
            ),
          "original OS assertion line 430",
        );
        collectOsAssertion(
          () =>
            assert.equal(
              Object.keys(env).some((key) =>
                key.startsWith("TTSC_GO_COMMAND_SHIM_"),
              ),
              false,
              "the caller's environment object must not be mutated",
            ),
          "original OS assertion line 431",
        );
      }
      wrapperMatrixFinished = true;
    } catch (cause) {
      failures.push(new Error("Windows wrapper fixture or capture", { cause }));
    }
    try {
      operation = "native ENOENT reference";
      nativeReferenceAttempted = true;
      const native = spawnSync(path.join(root, "absent-native"), ["version"], {
        encoding: "utf8",
        windowsHide: true,
      });
      const nativeError = native.error as NodeJS.ErrnoException | undefined;
      collectOsAssertion(
        () => assert.equal(nativeError?.code, "ENOENT"),
        "original OS assertion line 442",
      );
      const missing =
        process.platform === "win32"
          ? [
              "missing-go",
              "missing-go.cmd",
              "missing-go.bat",
              "MISSING-GO.CMD",
              "missing-go.BAT",
              ".\\missing-go.cmd",
              path.join(root, "missing-go.cmd"),
              path.join(root, "missing-go.bat"),
            ]
          : ["missing-go", path.join(root, "missing-go")];
      for (const binary of missing) {
        const result = spawnGoTool(binary, ["version"], {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, PATH: root, PATHEXT: ".COM;.EXE;.BAT;.CMD" },
          windowsHide: true,
        });
        const error = result.error as NodeJS.ErrnoException | undefined;
        collectOsAssertion(
          () => assert.equal(error?.code, "ENOENT", binary),
          "original OS assertion line 465",
        );
        collectOsAssertion(
          () => assert.equal(error?.errno, nativeError?.errno, binary),
          "original OS assertion line 466",
        );
        collectOsAssertion(
          () => assert.equal(error?.syscall, `spawnSync ${binary}`, binary),
          "original OS assertion line 467",
        );
        collectOsAssertion(
          () => assert.equal(error?.path, binary, binary),
          "original OS assertion line 468",
        );
        collectOsAssertion(
          () =>
            assert.deepEqual(
              (
                error as
                  | {
                      spawnargs?: string[];
                    }
                  | undefined
              )?.spawnargs,
              ["version"],
              binary,
            ),
          "original OS assertion line 469",
        );
        collectOsAssertion(
          () => assert.equal(result.status, null, binary),
          "original OS assertion line 474",
        );
        collectOsAssertion(
          () => assert.equal(result.pid, native.pid, binary),
          "original OS assertion line 475",
        );
      }
      nativeMissingMatrixFinished = true;
    } catch (cause) {
      failures.push(new Error("native missing-process matrix", { cause }));
    }
  } finally {
    try {
      const temporaryRoot = fs.realpathSync.native(os.tmpdir());
      const ownedRoot = fs.realpathSync.native(root);
      const relative = path.relative(temporaryRoot, ownedRoot);
      if (
        relative === "" ||
        relative === ".." ||
        relative.startsWith(".." + path.sep) ||
        path.isAbsolute(relative)
      )
        throw new Error(
          "OS corpus cleanup target is outside its owned temporary root",
        );
      fs.rmSync(ownedRoot, { recursive: true, force: true });
      assert.equal(
        fs.existsSync(ownedRoot),
        false,
        "owned OS corpus root is removed",
      );
      cleanupCompleted = true;
    } catch (cause) {
      failures.push(new Error("OS corpus final cleanup", { cause }));
    }
  }
  const report = {
    platform: process.platform,
    outcome:
      !wrapperMatrixFinished ||
      !nativeMissingMatrixFinished ||
      !cleanupCompleted
        ? "BLOCKED"
        : failures.length !== 0
          ? "FAIL"
          : "PASS",
    wrapperMatrixExecuted: process.platform === "win32",
    wrapperMatrixFinished,
    cleanupCompleted,
    directAttemptedRequests: attempts.length,
    attempts,
    nativeMissingMatrixFinished,
    directToolRequests: receipts.length,
    directLaunchedChildren: receipts.filter((receipt) => receipt.pid > 0)
      .length,
    directMissingResults: receipts.filter((receipt) => receipt.missing).length,
    syntheticMissingCandidates: receipts.filter(
      (receipt) => receipt.syntheticMissingCandidate,
    ).length,
    receipts,
    metadataRequestsFromCurrentCalleePlan: process.platform === "win32" ? 8 : 0,
    nativeMissingReferenceRequests: Number(nativeReferenceAttempted),
    countBoundary:
      "Direct requests/returned pids are observed; nested metadata cardinality is a reviewed callee plan, not an OS process trace.",
    failures: failures.map((failure) => ({
      identity: failure.message,
      cause: String(failure.cause),
    })),
  };
  try {
    fs.writeFileSync(
      path.join(
        os.tmpdir(),
        "ttsc-native-go-tool-os-corpus-last-round-1611.json",
      ),
      JSON.stringify(report, null, 2) + "\n",
      "utf8",
    );
  } catch (cause) {
    failures.push(new Error("OS corpus report write", { cause }));
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "native Go-tool OS corpus failed");
}
