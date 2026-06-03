import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  getBoolean,
  getNumber,
  getString,
  parseFlags,
} from "../../flags/parser";
import { resolveBinary } from "../../compiler/internal/resolveBinary";
import { runBuild } from "../../compiler/internal/runBuild";
import {
  buildDefaultEmitHost,
  loadProjectPlugins,
} from "../../plugin/internal/loadProjectPlugins";
import { getCompilerVersionText } from "./getCompilerVersionText";
import { resolveCacheDir } from "./resolveCacheDir";

/**
 * CLI entry point for `ttsx`. Type-checks the owning project via tsgo, emits
 * JavaScript to a PID-isolated temp directory, rewrites ESM specifiers when
 * needed, and executes the compiled entry with the current Node.js runtime.
 *
 * @param argv - Command-line arguments (defaults to `process.argv.slice(2)`).
 * @returns The child-process exit code, or `2` on a ttsx-level error.
 */
export function runTtsx(
  argv: readonly string[] = process.argv.slice(2),
): number {
  try {
    return run(argv);
  } catch (error) {
    process.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

function run(argv: readonly string[]): number {
  const parsed = parseCLI(argv);
  if (parsed === "help") {
    printHelp();
    return 0;
  }
  if (parsed === "version") {
    process.stdout.write(
      `${getCompilerVersionText().replace(/^ttsc\b/, "ttsx")}\n`,
    );
    return 0;
  }

  const cwd = path.resolve(parsed.cwd ?? process.cwd());
  const entry = path.resolve(cwd, parsed.entry);
  if (!fs.existsSync(entry)) {
    process.stderr.write(`ttsx: entry not found: ${entry}\n`);
    return 2;
  }

  // Build the entry project's transform-stage plugin host once. That same
  // binary runs in `serve` mode as the per-file emit host: each `.ts` the
  // entry reaches is emitted through its owning program with the plugin's
  // transform applied, identical to a `ttsc build` of that file.
  const tsgoBinary = parsed.binary ?? resolveBinary({ env: process.env });
  if (tsgoBinary === null) {
    process.stderr.write(
      "ttsc: @typescript/native-preview is required.\n" +
        "Install the TypeScript-Go preview in the consuming project:\n" +
        "  npm i -D @typescript/native-preview\n",
    );
    return 2;
  }
  const cacheDir = resolveCacheDir(cwd, parsed.cacheDir);
  const loaded = loadProjectPlugins({
    binary: tsgoBinary,
    cacheDir,
    cwd,
    file: entry,
    tsconfig: parsed.project ? path.resolve(cwd, parsed.project) : undefined,
    // `--no-plugins` disables plugin discovery; ttsc's own `*.config.ts`
    // loaders use it so the ephemeral config tsconfig is not held to the host
    // project's plugin requirements.
    entries: parsed.noPlugins ? false : undefined,
  });
  // The per-file emit host: a transform-stage plugin's binary when the project
  // configures one (typia, …), otherwise the first-party utility host compiled
  // on demand from ttsc's own Go source. Both speak the same emit protocol — the
  // plugin host applies its transform, the plain host emits the JavaScript a
  // bare `ttsc build` writes — so the loader is identical for plugin and
  // plugin-less projects.
  const host = loaded.nativePlugins.find(
    (plugin) =>
      plugin.stage === "transform" &&
      typeof plugin.binary === "string" &&
      plugin.binary !== "",
  );
  const hostBin =
    host !== undefined
      ? (host.binary as string)
      : buildDefaultEmitHost({ projectRoot: loaded.project.root, cacheDir });
  // Type-check gate: a TypeScript runner must reject type errors, not just
  // transpile (ts-node's contract, not tsx's). Type-checking is a separate
  // concern from emitting — it runs over the whole program once, where a whole
  // program is correct and safe, while emit stays per-file. The edge cases that
  // plagued the old gate were all in whole-program *emit* (output-to-source
  // remap, binding shim), never in the check.
  const check = runBuild({
    binary: parsed.binary,
    cwd,
    emit: false,
    checkers: parsed.checkers,
    // A runner resolves `.ts` import specifiers itself, so the type-check must
    // accept them (as ts-node and tsx do). The check is no-emit, so the option
    // is always valid here.
    passthrough: ["--allowImportingTsExtensions", ...parsed.tsgoFlags],
    // Type-checking is tsgo's job; a transform plugin (e.g. typia) only rewrites
    // calls at emit and never changes types, so the gate runs as a plain tsgo
    // no-emit check, which also keeps tsgo flags off the plugin host's parser.
    plugins: false,
    projectRoot: loaded.project.root,
    singleThreaded: parsed.singleThreaded,
    tsconfig: loaded.project.path,
  });
  // Report and gate on the user's own type errors only. A dependency served as
  // raw `.ts` (typia, @typia/template) lands its source in the program, so a
  // whole-program check also surfaces that source's lint (unused type params,
  // …) — the dependency's concern, not the user's. Keep diagnostics for files
  // under the entry project's root; tolerate the rest.
  const userDiagnostics = filterUserDiagnostics(
    `${check.stderr}${check.stdout}`,
    cwd,
    loaded.project.root,
  );
  if (userDiagnostics.text !== "") {
    process.stderr.write(userDiagnostics.text);
  }
  if (userDiagnostics.hasErrors) {
    return check.status === 0 ? 1 : check.status;
  }
  return spawnEntry({
    cwd,
    entry,
    entryTsconfig: loaded.project.path,
    hostBin,
    parsed,
  });
}

/**
 * Keep only the diagnostics whose source file lives under the entry project's
 * root, dropping noise from dependency sources served as raw `.ts`. A
 * diagnostic block is the header line (`path(line,col): error TSxxxx: …`) plus
 * any following continuation lines, until the next header.
 */
function filterUserDiagnostics(
  output: string,
  cwd: string,
  projectRoot: string,
): { text: string; hasErrors: boolean } {
  const header = /^(.*?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:/;
  const kept: string[] = [];
  let keeping = false;
  let hasErrors = false;
  for (const raw of output.split("\n")) {
    const line = raw.replace(/\[[0-9;]*m/g, "");
    const match = header.exec(line);
    if (match !== null) {
      const file = path.resolve(cwd, match[1]!.trim());
      const relative = path.relative(projectRoot, file);
      keeping =
        relative !== "" &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative);
      if (keeping) {
        kept.push(line);
        if (match[4] === "error") {
          hasErrors = true;
        }
      }
    } else if (keeping && line.trim() !== "") {
      kept.push(line);
    }
  }
  return {
    text: kept.length === 0 ? "" : `${kept.join("\n")}\n`,
    hasErrors,
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseCLI(argv: readonly string[]) {
  // ttsx accepts ttsc-style flags plus its own `--no-plugins` / `--require`.
  // The shared schema engine recognises both; the engine returns positional
  // tokens (entry file + flag values that aren't `.ts`) and a passthrough
  // list mirroring the pre-schema behaviour.
  //
  // Order pin: ttsx accepts `-P` as an alias for `--project`. The schema
  // declares `-p` for ttsc; ttsx's lowercase shape would collide on `-p`
  // → `--tsconfig`, so the legacy `-P` (uppercase) is treated as `--project`
  // via a manual rewrite before the engine sees argv. We preserve the
  // historical behaviour and emit a structural error otherwise.
  const rewritten = argv.map((token) =>
    token === "-P"
      ? "--project"
      : token.startsWith("-P=")
        ? `--project=${token.slice("-P=".length)}`
        : token,
  );
  // Terminal flags (--help / --version) short-circuit before parsing so
  // ttsx prints help text even when the entry file is missing.
  for (const token of rewritten) {
    if (token === "-h" || token === "--help") return "help" as const;
    if (token === "-v" || token === "--version") return "version" as const;
  }
  const result = parseFlags({
    argv: rewritten,
    errorPrefix: "ttsx:",
    forwardAfterFirstPositional: true,
    honorDoubleDashSeparator: true,
    subcommand: "ttsx",
  });

  const entry = result.positional.find(looksLikeEntryFile);
  if (entry === undefined) {
    throw new Error("ttsx: entry file is required");
  }
  // With `forwardAfterFirstPositional: true` the parser reports
  // `result.positional` as just the entry, `result.passthrough` as flags
  // arriving BEFORE the entry (tsgo-forwarded), and `result.tail` as every
  // token AFTER the entry — those are the user program's argv (e.g. the
  // `generate --input src/input` tail of `ttsx typia.ts generate
  // --input src/input`) and MUST NOT reach tsgo. Anything in positional
  // that is not the entry is a pre-entry flag value (e.g. `--target es2020`)
  // that the parser stored positionally; forward those to tsgo with the
  // rest of `passthrough`.
  const preEntryValues: string[] = result.positional.filter(
    (token) => token !== entry && !looksLikeEntryFile(token),
  );
  const postEntryArgs: string[] = [...result.tail];

  const preload: string[] = [];
  // `--require` accepts repeated values; the schema engine writes the
  // LAST one into `values`, so reconstruct the full list by scanning the
  // raw argv. Mirrors the legacy parser's `preload.push(takeValue(...))`
  // behaviour.
  //
  // Stop the rescue scan at the first token that begins tail mode —
  // either the entry file or the `--` separator. Without this guard,
  // `ttsx entry.ts -r preload.cjs` would BOTH preload `preload.cjs` AND
  // forward `-r preload.cjs` to the entry's argv, double-effecting the
  // module load. The schema engine already routes post-entry tokens to
  // `result.tail`; the rescue scan must respect the same boundary.
  const scanEnd = rewritten.findIndex(
    (token) => looksLikeEntryFile(token) || token === "--",
  );
  const scanLimit = scanEnd === -1 ? rewritten.length : scanEnd;
  for (let i = 0; i < scanLimit; i += 1) {
    const token = rewritten[i]!;
    if (token === "-r" || token === "--require") {
      const value = rewritten[i + 1];
      if (value !== undefined && !value.startsWith("-")) {
        preload.push(value);
        i += 1;
      }
    } else if (token.startsWith("--require=")) {
      preload.push(token.slice("--require=".length));
    }
  }

  return {
    binary: getString(result, "--binary"),
    cacheDir: getString(result, "--cache-dir"),
    checkers: getNumber(result, "--checkers"),
    cwd: getString(result, "--cwd"),
    entry,
    noPlugins: getBoolean(result, "--no-plugins") === true,
    passthrough: postEntryArgs,
    preload,
    project: getString(result, "--tsconfig"),
    singleThreaded: getBoolean(result, "--singleThreaded") === true,
    tsgoFlags: [...result.passthrough, ...preEntryValues],
  };
}

/**
 * Report whether a bare CLI token is the TypeScript entry file rather than a
 * forwarded flag's value. ttsx runs a TypeScript entrypoint, so only a token
 * with a TypeScript source extension is treated as the entry.
 */
function looksLikeEntryFile(token: string): boolean {
  return [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));
}

function printHelp(): void {
  process.stdout.write(
    [
      "ttsx — TypeScript runner provided by ttsc.",
      "",
      "Usage:",
      "  ttsx [options] <entry.ts> [-- <argv...>]",
      "",
      "Options:",
      "  -P, --project <file>   Use an explicit tsconfig.json",
      "  --cwd <dir>            Resolve entry/project relative to this directory",
      "  --cache-dir <dir>      Override the runner and source-plugin cache root",
      "  --binary <path>        Use an explicit tsgo binary",
      "  --no-plugins           Build the project without ttsc plugins",
      "  -r, --require <module> Preload a module before the entrypoint",
      "  --singleThreaded       Run TypeScript-Go single-threaded (one checker)",
      "  --checkers <n>         Type-checker pool size (default: TypeScript-Go's)",
      "  -h, --help             Show this help",
      "  -v, --version          Print the runner version",
      "",
      "  Any other flag before the entry is forwarded to tsgo, so options like",
      "  --strict apply to the type-check (e.g. ttsx --strict src/index.ts).",
      "",
      "Examples:",
      "  ttsx src/index.ts",
      "  ttsx --project tsconfig.json src/index.ts -- --port 3000",
    ].join("\n"),
  );
  process.stdout.write("\n");
}

function resolvePreload(cwd: string, preload: string): string {
  if (path.isAbsolute(preload) || isRelativeSpecifier(preload)) {
    return path.resolve(cwd, preload);
  }
  return preload;
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

/**
 * Run the entry source directly: spawn a child Node that installs the runtime
 * hooks (via `--import`) and executes the `.ts` entry. The hooks emit each
 * reached `.ts` on demand through the host the parent built, so there is no
 * gate, no emitted byte store, and nothing to clean up.
 */
function spawnEntry(options: {
  cwd: string;
  entry: string;
  entryTsconfig: string;
  hostBin: string;
  parsed: Exclude<ReturnType<typeof parseCLI>, "help" | "version">;
}): number {
  const { cwd, entry, entryTsconfig, hostBin, parsed } = options;
  const bootstrap = path.join(__dirname, "runtime", "bootstrap.js");
  const registrar = pathToFileURL(
    path.join(__dirname, "registerRuntimeHooks.js"),
  ).href;
  // Install the hooks through NODE_OPTIONS, not a one-off `--import`, so any
  // child process the entry spawns (e.g. a worker running another `.ts` as its
  // own main) inherits them and resolves/emits `.ts` the same way.
  const nodeOptions = [
    process.env["NODE_OPTIONS"],
    `--import ${registrar}`,
    "--disable-warning=ExperimentalWarning",
  ]
    .filter((part): part is string => part !== undefined && part !== "")
    .join(" ");
  const args = [
    ...parsed.preload.flatMap((preload) => [
      "-r",
      resolvePreload(cwd, preload),
    ]),
    bootstrap,
  ];
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      TTSX_EMIT_HOST_BIN: hostBin,
      TTSX_EMIT_HOST_ARGS: JSON.stringify(["serve"]),
      TTSX_EMIT_HOST_CWD: cwd,
      TTSX_ENTRY_TSCONFIG: entryTsconfig,
      TTSX_ENTRY: entry,
      TTSX_ARGV: JSON.stringify(parsed.passthrough),
    },
  });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}
