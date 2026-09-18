import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createNativeProjectContextArgs } from "../../../compiler/internal/project/createNativeProjectContextArgs";
import { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
import { resolveBinary } from "../../../compiler/internal/resolveBinary";
import { resolveTsgo } from "../../../compiler/internal/resolveTsgo";
import { outputText } from "../../../compiler/internal/outputText";
import { spawnNative } from "../../../compiler/internal/spawnNative";
import { resolveNodeBinary } from "../../../internal/resolveNodeBinary";
import { hasProjectPluginEntries } from "../../../plugin/internal/load/hasProjectPluginEntries";
import { loadProjectPlugins } from "../../../plugin/internal/load/loadProjectPlugins";
import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectIdentity } from "../../../structures/internal/ITtscProjectIdentity";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { resolveTtscserverBinary } from "../resolveTtscserverBinary";
import { needsStdio } from "./needsStdio";
import { LSPProjectInputDigest } from "./LSPProjectInputDigest";
import { materializeLSPPluginManifest } from "./materializeLSPPluginManifest";
import { initialLSPProjectInputSnapshotIsCurrent } from "./initialLSPProjectInputSnapshotIsCurrent";
import { fingerprintInitialLSPProjectInputSnapshot } from "./fingerprintInitialLSPProjectInputSnapshot";

/**
 * Drive the ttscserver native binary from a node launcher. The launcher is
 * deliberately thin: argument parsing, version banners, and help text are owned
 * by the Go binary so future flags only need to change one layer. The JS side
 * performs the Node-owned setup that depends on package resolution:
 *
 * - Resolve the platform binary,
 * - Resolve the project TypeScript-Go binary for the native wrapper,
 * - Resolve the project config and materialize the private LSP plugin manifest,
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
  let execution: TtscserverEnvironment;
  try {
    execution = resolveTtscserverEnv(args);
  } catch (error) {
    process.stderr.write(
      `ttscserver: ${stripTtscPrefix(formatError(error))}\n`,
    );
    return 1;
  }
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync(binary, [...execution.args, ...args], {
      stdio: "inherit",
      env: execution.env,
      windowsHide: true,
    });
  } finally {
    execution.dispose();
  }
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

type LSPExecutionContext = {
  initialProjectInputs: ReadonlyMap<string, LSPProjectInputDigest.InitialLSPProjectInputSnapshot>;
  nativePlugins: readonly ITtscLoadedNativePlugin[];
  projectContext?: ITtscProjectIdentity;
  tsgoBinary: string;
};

type TtscserverEnvironment = {
  /** Flags prepended to the native invocation, ahead of the caller's argv. */
  args: readonly string[];
  dispose(): void;
  env: NodeJS.ProcessEnv;
};

const LSP_SELECTION_STABILITY_ATTEMPTS = 3;

/**
 * Build the environment for the native binary. In `--stdio` (LSP) mode the Go
 * binary needs the project tsgo binary plus any LSP-capable plugin sidecars the
 * JS loader resolved from config. Pass the manifest through a private temporary
 * file and inject canonical helper paths so the native host and every later
 * sidecar refresh use the same launch context.
 */
function resolveTtscserverEnv(argv: readonly string[]): TtscserverEnvironment {
  if (!argv.includes("--stdio")) {
    // Non-LSP invocations (--version, --help) do not shell out to tsgo.
    return { args: [], dispose() {}, env: process.env };
  }
  const context = resolveLspExecutionContext(argv);
  const env = lspSidecarEnvironment({
    cwd:
      context.projectContext?.logicalProjectRoot ??
      path.resolve(optionValue(argv, "--cwd") ?? process.cwd()),
    pluginConfigOrigin: context.projectContext?.pluginConfigOrigin,
    tsgoBinary: context.tsgoBinary,
  });
  delete env.TTSC_LSP_PLUGINS_JSON;
  delete env.TTSC_LSP_PLUGINS_FILE;
  const lspPlugins = context.nativePlugins.filter(
    (plugin) => plugin.capabilities?.lsp === true,
  );
  if (lspPlugins.length === 0) {
    // Nothing would be lost by an older native host, so keep it startable.
    return { args: [], dispose() {}, env };
  }
  const transport = materializeLSPPluginManifest({
    initialProjectInputs: Object.fromEntries(context.initialProjectInputs),
    plugins: serializeNativePlugins(context.nativePlugins),
    projectContext: context.projectContext,
    lspPlugins: lspPlugins.map((plugin) => ({
      binary: plugin.binary,
      ...(plugin.capabilities?.projectInputs === true
        ? { initialProjectInputKey: lspPluginTransportKey(plugin) }
        : {}),
      name: plugin.name,
      projectDiagnostics: plugin.capabilities?.projectDiagnostics === true,
      projectInputs: plugin.capabilities?.projectInputs === true,
      projectContextArgs: plugin.capabilities?.projectContextArgs === true,
      stage: plugin.stage,
    })),
  });
  // Deliver the manifest as an explicit flag rather than an inherited variable.
  // A native host that predates the flag rejects the invocation instead of
  // starting without the plugins this project declared, and nothing downstream
  // of the host inherits either a path to the manifest or its payload.
  return {
    args: ["--lsp-plugins-file", transport.path],
    dispose: transport.dispose,
    env,
  };
}

function lspSidecarEnvironment(options: {
  cwd: string;
  pluginConfigOrigin: string | undefined;
  tsgoBinary: string;
}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TTSC_TSGO_BINARY: options.tsgoBinary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "..", "launcher", "ttsx.js"),
  };
  const node = resolveNodeBinary(env, options.cwd);
  if (node === undefined) delete env.TTSC_NODE_BINARY;
  else env.TTSC_NODE_BINARY = node;
  if (options.pluginConfigOrigin === undefined) {
    delete env.TTSC_PLUGIN_CONFIG_DIR;
  } else {
    env.TTSC_PLUGIN_CONFIG_DIR = options.pluginConfigOrigin;
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
    const confirmedTsgo = resolveTsgo({
      binary: optionValue(argv, "--tsgo"),
      cwd: confirmedProject.root,
      resolveFrom: __filename,
    });
    const confirmedProjectInputs = captureInitialLSPProjectInputs({
      nativePlugins: confirmation.nativePlugins,
      pluginConfigOrigin,
      project: confirmedProject,
      tsgoBinary: confirmedTsgo.binary,
    });
    if (
      lspSelectionSignature(selectedProject, loaded.nativePlugins) ===
        lspSelectionSignature(confirmedProject, confirmation.nativePlugins) &&
      initialLSPProjectInputsEqual(
        initialProjectInputs,
        confirmedProjectInputs,
      ) &&
      [...confirmedProjectInputs.values()].every(
        initialLSPProjectInputSnapshotIsCurrent,
      )
    ) {
      return {
        initialProjectInputs: confirmedProjectInputs,
        nativePlugins: confirmation.nativePlugins,
        projectContext: {
          ...confirmedProject.identity,
          ...(pluginConfigOrigin === undefined ? {} : { pluginConfigOrigin }),
        },
        tsgoBinary: confirmedTsgo.binary,
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
        tsconfig: project.identity.logicalConfigPath,
      })
    : {
        deferredHostInputs: [],
        hostInputHashes: {},
        hostInputRealpaths: {},
        hostInputs: [...project.configPaths],
        nativePlugins: [],
        project,
      };
}

function captureInitialLSPProjectInputs(options: {
  nativePlugins: readonly ITtscLoadedNativePlugin[];
  pluginConfigOrigin: string | undefined;
  project: ITtscParsedProjectConfig;
  tsgoBinary: string;
}): ReadonlyMap<string, LSPProjectInputDigest.InitialLSPProjectInputSnapshot> {
  const snapshots = new Map<string, LSPProjectInputDigest.InitialLSPProjectInputSnapshot>();
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
    const env = lspSidecarEnvironment({
      cwd: options.project.root,
      pluginConfigOrigin: options.pluginConfigOrigin,
      tsgoBinary: options.tsgoBinary,
    });
    const result = spawnNative(plugin.binary, args, {
      cwd: options.project.root,
      env,
    });
    if (result.error) {
      throw new Error(
        `ttscserver: ${plugin.name ?? plugin.binary} project-inputs failed: ${result.error.message}`,
      );
    }
    const stdout = outputText(result.stdout).trim();
    if (result.status !== 0) {
      const detail = outputText(result.stderr).trim() || stdout;
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

function initialLSPProjectInputsEqual(
  left: ReadonlyMap<string, LSPProjectInputDigest.InitialLSPProjectInputSnapshot>,
  right: ReadonlyMap<string, LSPProjectInputDigest.InitialLSPProjectInputSnapshot>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [key, leftSnapshot] of left) {
    const rightSnapshot = right.get(key);
    if (
      rightSnapshot === undefined ||
      initialLSPProjectInputSnapshotSignature(leftSnapshot) !==
        initialLSPProjectInputSnapshotSignature(rightSnapshot)
    ) {
      return false;
    }
  }
  return true;
}

function initialLSPProjectInputSnapshotSignature(
  snapshot: LSPProjectInputDigest.InitialLSPProjectInputSnapshot,
): string {
  const sorted = (values: readonly string[] | undefined): string[] =>
    [...(values ?? [])].sort();
  const reloadDirectories = sorted(snapshot.reloadDirectories);
  const reloadFiles = sorted(snapshot.reloadFiles);
  return JSON.stringify({
    files: sorted(snapshot.files),
    globs: sorted(snapshot.globs),
    reloadDirectories: reloadDirectories.map((directory) => [
      directory,
      snapshot.reloadDirectoryDigests[directory],
    ]),
    reloadFiles: reloadFiles.map((file) => [
      file,
      snapshot.reloadFileDigests[file],
    ]),
    root: snapshot.root,
  });
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
