import {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
  type StdioOptions,
  spawnSync,
} from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import util from "node:util";

import { captureProcessOutput } from "../../../compiler/internal/captureProcessOutput";
import { spawnSyncResilient } from "../../../internal/spawnSyncResilient";
import { GoToolResolution } from "./GoToolResolution";
import { windowsGoCommandArgs } from "./windowsGoCommandArgs";

/**
 * Run a Go tool command synchronously and return its complete output.
 *
 * Output is captured through files rather than pipes, so no buffer ceiling can
 * turn a verbose `go build` into a failure. On Windows a `.cmd` or `.bat`
 * wrapper is run through a generated shim with exact argument quoting; a
 * descriptor-exhaustion failure on POSIX is retried through the low-descriptor
 * broker.
 *
 * @evidence contracts/common.md#principled-implementation Child streams are routed to owned files and then reconstructed as the normal SpawnSyncReturns shape; Windows wrappers receive one-pass environment expansion and native argv quoting rather than unsafe shell concatenation.
 * @evidence contracts/common.md#clear-and-simple-design Output capture lifetime is separate from process selection and wrapper quoting; finally covers spawn failures and output-read failures alike.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts POSIX broker retry handles actual descriptor exhaustion and Windows cmd handles supported batch wrappers; neither changes a failed build into an assumed success.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain file capture, missing-wrapper ENOENT and the platform errno/quoting semantics; prose and tags remain distinct.
 * @evidence contracts/portability.md#os-neutral-implementation Windows cmd wrappers are isolated with verbatim arguments and case-insensitive environment lookup; native binaries and POSIX go use Node spawning and the descriptor broker.
 * @evidence contracts/performance.md#efficient-algorithms Output capture avoids the spawn buffer ceiling, then reads O(B) captured bytes once; wrapper argument encoding is linear in total argument length.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Go commands can write build/module state and cannot share a result merely because executable and arguments match.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources This synchronous call owns capture files/descriptors and releases them in finally; returned stdout/stderr occupy O(B) bytes owned by the caller, with no output-size bound imposed here.
 */
export function spawnGoTool(
  goBinary: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string> {
  // The child's streams go to files rather than pipes, so no output ceiling
  // applies: `spawnSync` only bounds what it must hold in this process's
  // memory, and a `go build` that says a great deal is not a failure to invent
  // a limit for. See `captureProcessOutput`.
  const capture = captureProcessOutput();
  const spawnOptions = {
    ...options,
    stdio: ["ignore", capture.stdoutFd, capture.stderrFd] as StdioOptions,
  };
  try {
    const result = spawnGoToolProcess(goBinary, args, spawnOptions, {
      stderr: capture.stderrPath,
      stdout: capture.stdoutPath,
    });
    const stdout = capture.read("stdout", "utf8") as string;
    const stderr = capture.read("stderr", "utf8") as string;
    return {
      ...result,
      output: [null, stdout, stderr],
      stderr,
      stdout,
    };
  } finally {
    capture.dispose();
  }
}

/**
 * Launch the Go tool, routing through cmd.exe only where Windows needs a
 * wrapper. Output routing is the caller's concern; this owns process
 * selection.
 */
function spawnGoToolProcess(
  goBinary: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
  output: { stderr: string; stdout: string },
): ReturnType<typeof spawnSync> {
  if (process.platform !== "win32") {
    return spawnSyncResilient(goBinary, args, options, output);
  }
  const inheritedEnv = options.env ?? process.env;
  const resolved = GoToolResolution.resolveWindowsGoTool(
    goBinary,
    inheritedEnv,
    spawnWorkingDirectory(options.cwd),
  );
  if (!resolved.wrapper) {
    return spawnSync(goBinary, [...args], options);
  }
  // Preserve the native spawn ENOENT contract before cmd.exe becomes the
  // actual child process. The callers use that code for the install guidance.
  // The wrapper is known to be missing, so nothing is spawned: Node refuses to
  // launch a `.cmd` or `.bat` without a shell (CVE-2024-27980) and answers
  // EINVAL, which would hide that the file does not exist.
  if (resolved.location === null) {
    return missingGoTool(goBinary, args);
  }
  const shim = createWindowsGoCommandShim([resolved.location, ...args]);
  return spawnSync(
    GoToolResolution.readWindowsEnvironmentValue(inheritedEnv, "COMSPEC") ??
      GoToolResolution.readWindowsEnvironmentValue(process.env, "COMSPEC") ??
      "cmd.exe",
    windowsGoCommandArgs(shim.payload),
    {
      ...options,
      env: { ...inheritedEnv, ...shim.environment },
      shell: false,
      // The /c payload is already one fully quoted Windows command line.
      windowsVerbatimArguments: true,
    },
  );
}

/**
 * The result Node's `spawnSync` returns for an executable that does not exist:
 * no process, and an ENOENT error carrying the platform's own errno, syscall,
 * path, and arguments.
 */
function missingGoTool(
  goBinary: string,
  args: readonly string[],
): ReturnType<typeof spawnSync> {
  const error = Object.assign(new Error(`spawnSync ${goBinary} ENOENT`), {
    code: "ENOENT",
    errno: systemErrno("ENOENT"),
    path: goBinary,
    spawnargs: [...args],
    syscall: `spawnSync ${goBinary}`,
  });
  return {
    error,
    output: [null, "", ""],
    pid: 0,
    signal: null,
    status: null,
    stderr: "",
    stdout: "",
  };
}

/** The platform errno Node reports for the named system error. */
function systemErrno(name: string): number | undefined {
  for (const [errno, [errorName]] of util.getSystemErrorMap()) {
    if (errorName === name) return errno;
  }
  return undefined;
}

function spawnWorkingDirectory(
  cwd: SpawnSyncOptionsWithStringEncoding["cwd"],
): string {
  if (cwd === undefined) return process.cwd();
  return path.resolve(typeof cwd === "string" ? cwd : fileURLToPath(cwd));
}

/** Pass volatile cmd wrapper arguments through one-pass environment expansion. */
function createWindowsGoCommandShim(args: readonly string[]): {
  environment: NodeJS.ProcessEnv;
  payload: string;
} {
  const prefix = `TTSC_GO_COMMAND_SHIM_${crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()}_ARG_`;
  const environment = Object.fromEntries(
    args.map((arg, index) => [prefix + index, quoteWindowsCommandArg(arg)]),
  );
  return {
    environment,
    // cmd expands each placeholder exactly once. Percent-shaped text inside an
    // expanded value is not scanned as a second environment reference.
    payload: `"${args.map((_, index) => `%${prefix}${index}%`).join(" ")}"`,
  };
}

/** Quote one argv value for the Windows command-line parser used by cmd. */
function quoteWindowsCommandArg(arg: string): string {
  return `"${String(arg)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\*)$/, "$1$1")}"`;
}
