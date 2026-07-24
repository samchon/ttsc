import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createNativeProjectContextArgs } from "../../compiler/internal/project/createNativeProjectContextArgs";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveBinary } from "../../compiler/internal/resolveBinary";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import {
  hasProjectPluginEntries,
  loadProjectPlugins,
} from "../../plugin/internal/loadProjectPlugins";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectIdentity } from "../../structures/internal/ITtscProjectIdentity";
import type { ITtscProjectInputSnapshot } from "../../structures/internal/ITtscProjectInputSnapshot";
import { resolveTtscserverBinary } from "./resolveTtscserverBinary";

type InitialLSPProjectInputSnapshot = ITtscProjectInputSnapshot & {
  reloadDirectoryDigests: Readonly<Record<string, string>>;
  reloadFileDigests: Readonly<Record<string, string>>;
};

type LSPExecutionContext = {
  initialProjectInputs: ReadonlyMap<string, InitialLSPProjectInputSnapshot>;
  nativePlugins: readonly ITtscLoadedNativePlugin[];
  projectContext?: ITtscProjectIdentity;
  tsgoBinary: string;
};

const LSP_SELECTION_STABILITY_ATTEMPTS = 3;
const LSP_PROJECT_INPUT_TIMEOUT_MS = 30_000;
const LSP_PROJECT_INPUT_MAX_BUFFER = 4 * 1024 * 1024;

/**
 * Drive the ttscserver native binary from a node launcher. The launcher is
 * deliberately thin: argument parsing, version banners, and help text are owned
 * by the Go binary so future flags only need to change one layer. The JS side
 * performs the Node-owned setup that depends on package resolution:
 *
 * - Resolve the platform binary,
 * - Resolve the project TypeScript-Go binary for the native wrapper,
 * - Resolve the project config and build the LSP plugin manifest environment,
 * - Inject the Node/ttsx helper paths used by disk-backed LSP sidecars,
 * - Inject `--stdio` when the first arg is not a meta-command,
 * - Delegate to the binary with inherited stdio so OS-level signals reach the
 *   child via the parent's process group.
 */
export function runTtscserver(
  argv: readonly string[] = process.argv.slice(2),
): number {
  const binary = resolveTtscserverBinary();
  if (!binary) {
    process.stderr.write(
      [
        `ttscserver: platform-specific binary not found (@ttsc/${process.platform}-${process.arch}).`,
        `Set TTSCSERVER_BINARY to an absolute path or reinstall ttsc with optional dependencies enabled.`,
      ].join("\n") + "\n",
    );
    return 1;
  }
  ensureExecutable(binary);

  const args = needsStdio(argv) ? ["--stdio", ...argv] : [...argv];
  let env: NodeJS.ProcessEnv;
  try {
    env = resolveTtscserverEnv(args);
  } catch (error) {
    process.stderr.write(
      `ttscserver: ${stripTtscPrefix(formatError(error))}\n`,
    );
    return 1;
  }
  const result = spawnSync(binary, args, {
    stdio: "inherit",
    env,
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`ttscserver: ${result.error.message}\n`);
    return 1;
  }
  if (result.signal) {
    // POSIX convention: 128 + signum so wrappers (bash, npm-script, CI)
    // can decode the signal that killed the child (130 = SIGINT, 143 =
    // SIGTERM, etc.). On Windows, `spawnSync` does not surface a signal
    // (TerminateProcess carries no signum) so this branch is POSIX-only
    // by design; Windows-killed children take the `result.status ?? 1`
    // path below.
    const signum = (os.constants.signals as Record<string, number | undefined>)[
      result.signal
    ];
    return typeof signum === "number" ? 128 + signum : 1;
  }
  return result.status ?? 1;
}

/**
 * Build the environment for the native binary. In `--stdio` (LSP) mode the Go
 * binary needs the project tsgo binary plus any LSP-capable plugin sidecars the
 * JS loader resolved from config. Inject those paths through environment
 * variables so the native host can stay focused on proxying tsgo and
 * dispatching sidecar verbs. Skip `TTSC_TSGO_BINARY` injection when the caller
 * already provided the variable or passed an explicit `--tsgo` option.
 */
function resolveTtscserverEnv(argv: readonly string[]): NodeJS.ProcessEnv {
  if (!argv.includes("--stdio")) {
    // Non-LSP invocations (--version, --help) do not shell out to tsgo.
    return process.env;
  }
  const context = resolveLspExecutionContext(argv);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TTSC_NODE_BINARY: process.env.TTSC_NODE_BINARY ?? process.execPath,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
  };
  delete env.TTSC_LSP_PLUGINS_JSON;
  if (!process.env.TTSC_TSGO_BINARY && !hasTsgoOption(argv)) {
    env.TTSC_TSGO_BINARY = context.tsgoBinary;
  }
  const lspPlugins = context.nativePlugins.filter(
    (plugin) => plugin.capabilities?.lsp === true,
  );
  if (lspPlugins.length > 0) {
    env.TTSC_LSP_PLUGINS_JSON = JSON.stringify({
      plugins: serializeNativePlugins(context.nativePlugins),
      projectContext: context.projectContext,
      lspPlugins: lspPlugins.map((plugin) => ({
        binary: plugin.binary,
        initialProjectInputs: context.initialProjectInputs.get(
          lspPluginTransportKey(plugin),
        ),
        name: plugin.name,
        projectDiagnostics: plugin.capabilities?.projectDiagnostics === true,
        projectInputs: plugin.capabilities?.projectInputs === true,
        projectContextArgs: plugin.capabilities?.projectContextArgs === true,
        stage: plugin.stage,
      })),
    });
  }
  return env;
}

function resolveLspExecutionContext(
  argv: readonly string[],
): LSPExecutionContext {
  const cwd = path.resolve(optionValue(argv, "--cwd") ?? process.cwd());
  const tsconfig = optionValue(argv, "--tsconfig");
  const pluginConfigOrigin =
    process.env.TTSC_PLUGIN_CONFIG_DIR === undefined ||
    process.env.TTSC_PLUGIN_CONFIG_DIR === ""
      ? undefined
      : path.resolve(cwd, process.env.TTSC_PLUGIN_CONFIG_DIR);
  let initialProject: ReturnType<typeof readProjectConfig>;
  try {
    initialProject = readProjectConfig({ cwd, tsconfig });
  } catch (error) {
    if (tsconfig) {
      throw error;
    }
    const tsgo = resolveTsgo({
      binary: optionValue(argv, "--tsgo"),
      cwd,
      resolveFrom: __filename,
    });
    return {
      initialProjectInputs: new Map(),
      nativePlugins: [],
      tsgoBinary: tsgo.binary,
    };
  }
  let project = initialProject;
  for (
    let attempt = 1;
    attempt <= LSP_SELECTION_STABILITY_ATTEMPTS;
    attempt++
  ) {
    const loaded = loadLSPProjectPlugins(project, cwd, pluginConfigOrigin);
    const selectedProject = loaded.project;
    const tsgo = resolveTsgo({
      binary: optionValue(argv, "--tsgo"),
      cwd: selectedProject.root,
      resolveFrom: __filename,
    });
    const initialProjectInputs = captureInitialLSPProjectInputs({
      nativePlugins: loaded.nativePlugins,
      pluginConfigOrigin,
      project: selectedProject,
      tsgoBinary: tsgo.binary,
    });
    const confirmationProject = readProjectConfig({ cwd, tsconfig });
    const confirmation = loadLSPProjectPlugins(
      confirmationProject,
      cwd,
      pluginConfigOrigin,
    );
    const confirmedProject = confirmation.project;
    if (
      lspSelectionSignature(selectedProject, loaded.nativePlugins) ===
        lspSelectionSignature(confirmedProject, confirmation.nativePlugins) &&
      [...initialProjectInputs.values()].every(
        initialLSPProjectInputSnapshotIsCurrent,
      )
    ) {
      return {
        initialProjectInputs,
        nativePlugins: confirmation.nativePlugins,
        projectContext: {
          ...confirmedProject.identity,
          ...(pluginConfigOrigin === undefined ? {} : { pluginConfigOrigin }),
        },
        tsgoBinary: tsgo.binary,
      };
    }
    project = confirmedProject;
  }
  throw new Error(
    `ttscserver: project plugin selection remained unstable across ${LSP_SELECTION_STABILITY_ATTEMPTS} bounded startup attempts`,
  );
}

function loadLSPProjectPlugins(
  project: ITtscParsedProjectConfig,
  cwd: string,
  pluginConfigOrigin: string | undefined,
): ReturnType<typeof loadProjectPlugins> {
  return hasProjectPluginEntries(project)
    ? loadProjectPlugins({
        binary: resolveBinary() ?? "",
        cwd,
        pluginConfigDir: pluginConfigOrigin,
        projectRoot: project.root,
        tsconfig: project.path,
      })
    : { nativePlugins: [], project };
}

function captureInitialLSPProjectInputs(options: {
  nativePlugins: readonly ITtscLoadedNativePlugin[];
  pluginConfigOrigin: string | undefined;
  project: ITtscParsedProjectConfig;
  tsgoBinary: string;
}): ReadonlyMap<string, InitialLSPProjectInputSnapshot> {
  const snapshots = new Map<string, InitialLSPProjectInputSnapshot>();
  const pluginsJSON = JSON.stringify(
    serializeNativePlugins(options.nativePlugins),
  );
  for (const plugin of options.nativePlugins) {
    if (
      plugin.capabilities?.lsp !== true ||
      plugin.capabilities.projectInputs !== true
    ) {
      continue;
    }
    const transportKey = lspPluginTransportKey(plugin);
    if (snapshots.has(transportKey)) continue;
    const args = [
      "project-inputs",
      "--tsconfig=" + options.project.path,
      "--plugins-json=" + pluginsJSON,
      "--cwd=" + options.project.root,
    ];
    if (plugin.capabilities.projectContextArgs === true) {
      args.push(
        ...createNativeProjectContextArgs(
          options.project,
          options.pluginConfigOrigin,
        ),
      );
    }
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TTSC_NODE_BINARY: process.env.TTSC_NODE_BINARY ?? process.execPath,
      TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? options.tsgoBinary,
      TTSC_TTSX_BINARY:
        process.env.TTSC_TTSX_BINARY ??
        path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    };
    if (options.pluginConfigOrigin === undefined) {
      delete env.TTSC_PLUGIN_CONFIG_DIR;
    } else {
      env.TTSC_PLUGIN_CONFIG_DIR = options.pluginConfigOrigin;
    }
    const result = spawnSync(plugin.binary, args, {
      cwd: options.project.root,
      encoding: "utf8",
      env,
      maxBuffer: LSP_PROJECT_INPUT_MAX_BUFFER,
      timeout: LSP_PROJECT_INPUT_TIMEOUT_MS,
      windowsHide: true,
    });
    if (result.error) {
      throw new Error(
        `ttscserver: ${plugin.name ?? plugin.binary} project-inputs failed: ${result.error.message}`,
      );
    }
    const stdout = result.stdout.trim();
    if (result.status !== 0) {
      const detail = result.stderr.trim() || stdout;
      throw new Error(
        `ttscserver: ${plugin.name ?? plugin.binary} project-inputs failed${detail ? `: ${detail}` : ""}`,
      );
    }
    snapshots.set(
      transportKey,
      fingerprintInitialLSPProjectInputSnapshot(
        parseInitialLSPProjectInputSnapshot(stdout, plugin),
      ),
    );
  }
  return snapshots;
}

function lspPluginTransportKey(plugin: ITtscLoadedNativePlugin): string {
  return (
    plugin.binary +
    "\0" +
    (plugin.capabilities?.projectContextArgs === true ? "1" : "0")
  );
}

function parseInitialLSPProjectInputSnapshot(
  text: string,
  plugin: ITtscLoadedNativePlugin,
): ITtscProjectInputSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `ttscserver: ${plugin.name ?? plugin.binary} project-inputs returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    value === null ||
    typeof value !== "object" ||
    typeof (value as ITtscProjectInputSnapshot).root !== "string" ||
    !Array.isArray((value as ITtscProjectInputSnapshot).files) ||
    !Array.isArray((value as ITtscProjectInputSnapshot).globs) ||
    ((value as ITtscProjectInputSnapshot).reloadFiles !== undefined &&
      !Array.isArray((value as ITtscProjectInputSnapshot).reloadFiles)) ||
    ((value as ITtscProjectInputSnapshot).reloadDirectories !== undefined &&
      !Array.isArray((value as ITtscProjectInputSnapshot).reloadDirectories))
  ) {
    throw new Error(
      `ttscserver: ${plugin.name ?? plugin.binary} project-inputs returned a malformed snapshot`,
    );
  }
  return value as ITtscProjectInputSnapshot;
}

export function fingerprintInitialLSPProjectInputSnapshot(
  snapshot: ITtscProjectInputSnapshot,
): InitialLSPProjectInputSnapshot {
  const reloadDirectoryDigests: Record<string, string> = {};
  const reloadFileDigests: Record<string, string> = {};
  for (const directory of snapshot.reloadDirectories ?? []) {
    reloadDirectoryDigests[directory] = lspProjectInputDirectoryDigest(
      realLSPProjectInputPath(directory),
    );
  }
  for (const file of snapshot.reloadFiles ?? []) {
    reloadFileDigests[file] = lspProjectInputFileDigest(
      realLSPProjectInputPath(file),
    );
  }
  return {
    ...snapshot,
    reloadDirectoryDigests,
    reloadFileDigests,
  };
}

export function initialLSPProjectInputSnapshotIsCurrent(
  snapshot: InitialLSPProjectInputSnapshot,
): boolean {
  return (
    (snapshot.reloadDirectories ?? []).every(
      (directory) =>
        snapshot.reloadDirectoryDigests[directory] ===
        lspProjectInputDirectoryDigest(realLSPProjectInputPath(directory)),
    ) &&
    (snapshot.reloadFiles ?? []).every(
      (file) =>
        snapshot.reloadFileDigests[file] ===
        lspProjectInputFileDigest(realLSPProjectInputPath(file)),
    )
  );
}

function lspSelectionSignature(
  project: ITtscParsedProjectConfig,
  plugins: readonly ITtscLoadedNativePlugin[],
): string {
  return JSON.stringify({
    identity: project.identity,
    plugins: plugins.map((plugin) => ({
      binary: plugin.binary,
      capabilities: plugin.capabilities,
      config: plugin.config,
      contributors: plugin.contributors,
      kind: plugin.kind,
      name: plugin.name,
      source: plugin.source,
      stage: plugin.stage,
    })),
  });
}

function lspProjectInputDirectoryDigest(location: string): string {
  const entries: Buffer[] = [];
  try {
    if (process.platform === "win32") {
      for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
        let target = Buffer.alloc(0);
        if (entry.isSymbolicLink()) {
          try {
            target = Buffer.from(
              fs.readlinkSync(path.join(location, entry.name)),
              "utf8",
            );
          } catch {
            target = Buffer.from("<unreadable>");
          }
        }
        entries.push(
          lspProjectInputDirectoryRecord(
            Buffer.from(entry.name),
            entry,
            target,
          ),
        );
      }
    } else {
      for (const entry of fs.readdirSync(location, {
        encoding: "buffer",
        withFileTypes: true,
      })) {
        let target = Buffer.alloc(0);
        if (entry.isSymbolicLink()) {
          try {
            target = fs.readlinkSync(
              Buffer.concat([
                Buffer.from(location),
                Buffer.from(path.sep),
                entry.name,
              ]),
              { encoding: "buffer" },
            );
          } catch {
            target = Buffer.from("<unreadable>");
          }
        }
        entries.push(lspProjectInputDirectoryRecord(entry.name, entry, target));
      }
    }
  } catch {
    return createHash("sha256").update("missing\0").digest("hex");
  }
  entries.sort(Buffer.compare);
  const serialized = Buffer.concat(
    entries.flatMap((entry, index) =>
      index === 0 ? [entry] : [Buffer.from([0]), entry],
    ),
  );
  return createHash("sha256").update(serialized).digest("hex");
}

function lspProjectInputDirectoryRecord(
  name: Buffer,
  entry: {
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  },
  target: Buffer,
): Buffer {
  const kind = entry.isDirectory()
    ? "directory"
    : entry.isFile()
      ? "file"
      : entry.isSymbolicLink()
        ? "symlink"
        : "other";
  return Buffer.concat([name, Buffer.from("\0" + kind + "\0"), target]);
}

function lspProjectInputFileDigest(location: string): string {
  try {
    const info = fs.lstatSync(location);
    if (info.isSymbolicLink()) {
      const target = fs.readlinkSync(location);
      let content = Buffer.from("missing\0");
      try {
        content = Buffer.concat([
          Buffer.from("file\0"),
          fs.readFileSync(location),
        ]);
      } catch {
        // A dangling or unreadable target remains part of the symlink state.
      }
      return createHash("sha256")
        .update(
          Buffer.concat([
            Buffer.from("symlink\0"),
            Buffer.from(target),
            Buffer.from([0]),
            content,
          ]),
        )
        .digest("hex");
    }
    if (info.isFile()) {
      return createHash("sha256")
        .update(
          Buffer.concat([Buffer.from("file\0"), fs.readFileSync(location)]),
        )
        .digest("hex");
    }
    return createHash("sha256").update("other\0").digest("hex");
  } catch {
    return createHash("sha256").update("missing\0").digest("hex");
  }
}

function realLSPProjectInputPath(location: string): string {
  const absolute = path.resolve(location);
  let probe = absolute;
  const suffix: string[] = [];
  for (;;) {
    try {
      let resolved = fs.realpathSync.native(probe);
      for (let index = suffix.length - 1; index >= 0; index--) {
        resolved = path.join(resolved, suffix[index]!);
      }
      return path.normalize(resolved);
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) return path.normalize(absolute);
      suffix.push(path.basename(probe));
      probe = parent;
    }
  }
}

function hasTsgoOption(argv: readonly string[]): boolean {
  return argv.some((arg) => arg === "--tsgo" || arg.startsWith("--tsgo="));
}

function optionValue(
  argv: readonly string[],
  name: string,
): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === name) {
      return argv[i + 1];
    }
    if (arg.startsWith(name + "=")) {
      return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

function serializeNativePlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): unknown[] {
  return plugins.map((plugin) => ({
    config: plugin.config,
    name: plugin.name,
    stage: plugin.stage,
  }));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stripTtscPrefix(message: string): string {
  return message.startsWith("ttsc: ")
    ? message.slice("ttsc: ".length)
    : message;
}

/**
 * `--stdio` is the only transport the native host accepts today. The launcher
 * injects it only when the first argv token looks like a forwarded option;
 * meta-commands (`-v`, `--help`, `version`, etc.) pass through untouched so the
 * Go binary owns the canonical banner. This mirrors
 * `cmd/ttscserver/main.go::run`, which dispatches on `args[0]` only.
 */
export function needsStdio(argv: readonly string[]): boolean {
  if (argv.length === 0) return false;
  if (argv.includes("--stdio")) return false;
  const head = argv[0];
  if (
    head === "-v" ||
    head === "--version" ||
    head === "version" ||
    head === "-h" ||
    head === "--help" ||
    head === "help"
  ) {
    return false;
  }
  return true;
}

/** Mirror the ttsc helper-binary chmod hint so first-run from npm works. */
function ensureExecutable(binary: string): void {
  if (process.platform === "win32") return;
  try {
    fs.accessSync(binary, fs.constants.X_OK);
    return;
  } catch {
    try {
      const mode = fs.statSync(binary).mode & 0o777;
      fs.chmodSync(binary, mode | 0o755);
    } catch {
      /* spawn will surface the underlying error */
    }
  }
}
