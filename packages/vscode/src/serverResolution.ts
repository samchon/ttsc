import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  type FilesystemPathIdentityContext,
  type FilesystemPathIdentityOperations,
  createFilesystemPathIdentityContext,
} from "ttsc/path-identity";

import {
  filterCandidatesByPhysicalRoots,
  planRootsByPhysicalIdentity,
} from "./clientRootPlanning.ts";

/**
 * A module-resolution base, server working directory and optional selected
 * project config.
 *
 * Resolution and server cwd may differ when an active file lives below its
 * project root.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Keeping resolveFrom distinct from cwd lets a nested source resolve its
 *   package while its server uses the owning config directory. Optional
 *   tsconfig distinguishes explicit selection from launcher discovery.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   These three fields express resolution and launch inputs together without
 *   retaining editor state or performing resolution inside the value.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   All three fields carry native filesystem paths. Node and the shared
 *   identity resolver interpret their separators and aliases; protocol URIs
 *   are converted before this boundary rather than stored as paths.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc distinguishes native module-resolution base, server cwd and
 *   optional config; the type comment explains why base and cwd can differ.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export type ResolutionCandidate = {
  /** Working directory for project-owned server execution. */
  cwd: string;

  /** Directory from which Node resolves the project's ttsc package. */
  resolveFrom: string;

  /** Selected config candidate; absence leaves launcher discovery enabled. */
  tsconfig?: string;
};

/**
 * Optional active file, owning workspace root and workspace roots used to
 * order resolution candidates.
 *
 * An absent active file leaves workspace-only discovery; an absent active
 * workspace root permits the normal ancestor search.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional activeFile and activeWorkspaceRoot allow workspace-only
 *   discovery without inventing an active document. Ordered workspaceRoots
 *   retain the caller's fallback priority.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This input separates editor selection from native discovery and carries
 *   only paths and ordering needed to construct resolution candidates.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Members are native paths, not URI strings. findProjectConfig uses shared
 *   physical identity to honor workspace aliases and Node path operations to
 *   walk directories under their actual host semantics.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains optional active-file and workspace-boundary inputs
 *   and ordered workspace fallbacks; the type comment states absent-input
 *   meaning. Purpose, conditions and reasons use separate native paragraphs
 *   under the documentation skill; member comments remain beside their
 *   fields.
 */
export type ResolutionCandidateInput = {
  /** Active file path; absence uses only the supplied workspace roots. */
  activeFile?: string;

  /** Owning workspace boundary passed to active-file project discovery. */
  activeWorkspaceRoot?: string;

  /** Workspace directories considered after the active file. */
  workspaceRoots?: readonly string[];
};

/**
 * Create the shared filesystem identity context used for language-client
 * root routing.
 *
 * Unresolvable realpaths default to conservative lexical identity; callers
 * can inject explicit identity operations without changing global filesystem
 * methods.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The maintained ttsc/path-identity API owns filesystem equivalence instead
 *   of a second lowercase/prefix approximation. Explicit operation injection
 *   is the supported observation boundary, with throwOnRealpathError
 *   defaulting to false.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One adapter supplies the conservative error default and passes the
 *   caller's observations to the owning identity API; it adds no second
 *   path-equivalence algorithm.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains conservative lexical fallback and explicit injected
 *   identity operations, including why globals are not replaced. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function createServerRootPathIdentityContext(
  platform: NodeJS.Platform = process.platform,
  operations: Partial<FilesystemPathIdentityOperations> = {},
): FilesystemPathIdentityContext {
  return createFilesystemPathIdentityContext({
    ...operations,
    platform,
    throwOnRealpathError: operations.throwOnRealpathError ?? false,
  });
}

/**
 * Node spawn options with a working directory, environment and optional
 * verbatim Windows arguments.
 *
 * Only prequoted command-shim payloads require verbatim arguments; ordinary
 * executable arguments retain Node escaping.
 *
 * @evidence contracts/common.md#principled-implementation
 *   cwd and env match Node spawn options. An optional verbatim flag preserves
 *   the distinction between prequoted Windows shim payloads and ordinary
 *   argument vectors, whose escaping remains Node's responsibility.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Process options are one record separate from command construction; the
 *   single optional flag exposes the only additional spawn mode required.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   These fields describe a native process boundary: Node argument vectors on
 *   ordinary launchers and explicit Windows cmd payload/environment for
 *   command shims. The type does not invoke the process itself.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains cwd, environment and optional Windows verbatim
 *   arguments; the type comment limits that flag to prequoted shim payloads.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export type ServerProcessOptions = {
  /** Project working directory passed to Node spawn. */
  cwd: string;

  /** Inherited environment with an optional project toolchain override. */
  env: NodeJS.ProcessEnv;

  /**
   * Node spawn option for an already quoted Windows command payload.
   *
   * The language client forwards it despite omitting it from ExecutableOptions;
   * absence retains Node's ordinary argument escaping.
   */
  windowsVerbatimArguments?: boolean;
};

/**
 * An executable name and argument vector, with optional Windows command-shim
 * environment and verbatim flag.
 *
 * JavaScript, native executable and Windows command-shim launchers require
 * distinct supported process boundaries.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The executable and argument vector represent an unspawned command.
 *   Optional environment and verbatim state carry the cmd-specific payload
 *   that createServerExecutable must forward together.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Command preparation returns its extra spawn requirements in the same
 *   record, leaving project environment resolution to the executable adapter.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   These fields describe a native process boundary: Node argument vectors on
 *   ordinary launchers and explicit Windows cmd payload/environment for
 *   command shims. The type does not invoke the process itself.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc describes executable, vector, shim environment and verbatim
 *   state; the type comment separates JS, native and command-shim boundaries.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export type ServerLaunchCommand = {
  /** Ordinary argument vector, or explicit cmd switches and quoted payload. */
  args: string[];

  /** Node executable, native launcher, or Windows command processor. */
  command: string;

  /** Private quoted-argument environment for the Windows command boundary. */
  commandShimEnvironment?: NodeJS.ProcessEnv;

  /** True only for prequoted Windows command payloads; otherwise omitted. */
  windowsVerbatimArguments?: boolean;
};

/**
 * The launch command, argument vector and optional process options passed to
 * the language client.
 *
 * Undefined options retain the client defaults; prepared options preserve
 * project cwd and toolchain environment.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The command, args and options match vscode-languageclient's executable
 *   input. Undefined options retain client defaults rather than manufacturing
 *   a working directory or environment.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This final transport record composes prepared command and process state
 *   without adding another launch policy or storing a live child process.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   These fields describe a native process boundary: Node argument vectors on
 *   ordinary launchers and explicit Windows cmd payload/environment for
 *   command shims. The type does not invoke the process itself.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc describes the language-client command, vector and optional
 *   prepared options; the type comment explains client defaults and project
 *   environment ownership. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 */
export type ServerExecutable = {
  /** Arguments forwarded to the selected launcher. */
  args: string[];

  /** Executable or command processor selected by the launch preparation. */
  command: string;

  /** Prepared spawn state, or undefined to retain client defaults. */
  options: ServerProcessOptions | undefined;
};

/**
 * A file and the selected client root as filesystem paths.
 *
 * The selection describes routing input, not an editor URI or permission to
 * write the file.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Distinct file and root fields express a containment-routing decision
 *   without conflating the selected root with the document to route.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The pair records only routing input; it does not retain clients or expose
 *   document-write operations.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The file and root are native filesystem paths, not editor URIs.
 *   selectDeepestRootForPath and the shared ttsc/path-identity context
 *   interpret containment, physical aliases and host filesystem case rules.
 *   This type stores that boundary without normalizing paths itself.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc identifies native file/root paths; the type comment
 *   distinguishes routing input from editor URI identity and write
 *   permission. Purpose, conditions and reasons use separate native
 *   paragraphs under the documentation skill; member comments remain beside
 *   their fields.
 */
export type ClientRootSelection = {
  /** Native file path routed to a client. */
  file: string;

  /** Selected native client root. */
  root: string;
};

/**
 * The VS Code RelativePattern constructor accepting a literal base and a
 * glob beneath it.
 *
 * The base must stay literal even when a workspace directory contains glob
 * metacharacters.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The constructor signature preserves separate literal-base and glob
 *   arguments and its generic result, matching VS Code RelativePattern without
 *   making the resolver import the editor runtime.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Constructor injection is the narrow boundary needed by pattern creation;
 *   a separate factory framework or editor dependency is unnecessary.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The base is a literal native workspace path;
 *   createDocumentSelectorPattern passes the recursive glob separately so
 *   root metacharacters are not interpreted as glob syntax. VS Code owns
 *   platform-specific RelativePattern matching. This signature neither joins
 *   separators manually nor equates a native path with a protocol URI.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the literal native base and separate glob, explaining
 *   why workspace metacharacters must remain literal. Purpose, conditions and
 *   reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 */
export type RelativePatternConstructor<T> = new (
  base: string,
  pattern: string,
) => T;

const PROJECT_CONFIG_PATTERN = /^(?:tsconfig|jsconfig)(?:\..*)?\.json$/;
const WRAPPED_COMMAND_IDS = ["ttsc.lint.fixAll", "ttsc.format.document"];

/**
 * Resolve the project-installed ttsc package anchor and return its existing
 * server launcher, or undefined on resolution/read failure.
 *
 * The exported package.json anchor and bin.ttscserver declaration avoid
 * importing an unexported package-internal module path. The legacy launcher
 * path is used only when the manifest has no string bin entry.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node createRequire resolves the workspace-owned exported package anchor;
 *   fs reads the bin declaration and checks the resolved launcher. This
 *   operation neither executes the launcher nor patches module resolution.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One resolver owns package-anchor lookup, manifest decoding and launcher
 *   existence. The caller receives a path or absence, not module internals.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The existing legacy path is a package compatibility default, not a
 *   fixture-specific workaround.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node createRequire, dirname/join/resolve and existsSync retain native
 *   package paths on Windows and POSIX. No file path is parsed as a URL or
 *   interpolated into a command.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states project package-anchor ownership, bin manifest selection,
 *   legacy-path conditions and undefined resolution/read failure. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */

export function resolveTtscServerLauncher(
  resolveFrom: string,
): string | undefined {
  try {
    const requireFromBase = createRequire(
      path.join(resolveFrom, "__ttsc_vscode_resolve__.cjs"),
    );
    const packageJson = requireFromBase.resolve("ttsc/package.json");
    const packageRoot = path.dirname(packageJson);
    const manifest = JSON.parse(fs.readFileSync(packageJson, "utf8")) as {
      bin?: { ttscserver?: unknown };
    };
    const bin =
      typeof manifest.bin?.ttscserver === "string"
        ? manifest.bin.ttscserver
        : path.join("lib", "launcher", "ttscserver.js");
    const launcher = path.resolve(packageRoot, bin);
    return fs.existsSync(launcher) ? launcher : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Return the directory of the project-config candidate selected by
 * findProjectConfig, or undefined.
 *
 * This wrapper delegates discovery instead of maintaining a second policy;
 * the finder limits discovery to the physical workspace boundary when given.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node dirname projects the owning finder result to a root, retaining
 *   undefined absence.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The wrapper projects one config result to its directory; file selection
 *   and the workspace boundary remain entirely with findProjectConfig.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No independent fallback skips the finder's boundary or usable-file
 *   selection. The root is exactly the selected config's directory.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node dirname preserves native roots and separators. The finder compares
 *   physical identity for case variants, symlinks and junctions rather than
 *   assuming an OS-wide case policy.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states delegation, undefined absence and physical workspace scope.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill;
 *   member comments remain beside their fields.
 */

export function findProjectRoot(
  start: string,
  stopAt?: string,
): string | undefined {
  const config = findProjectConfig(start, stopAt);
  return config ? path.dirname(config) : undefined;
}

/**
 * Walk upward for the nearest regular tsconfig/jsconfig file within the
 * optional physical workspace boundary.
 *
 * Canonical tsconfig.json wins over tsconfig variants, then jsconfig.json
 * and variants. Unreadable directories, stat-failing entries and non-files yield
 * no candidate. Readability and config syntax remain the launcher's responsibility.
 * A start outside the boundary returns undefined; case aliases and
 * physical links use the same filesystem identity as client routing.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The nearest directory is inspected first, so the first usable candidate
 *   owns the project. Boundary containment is checked before every scan and
 *   equality stops the walk after inspecting the workspace itself.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One loop owns ancestor progression and boundary enforcement; projectConfigIn
 *   owns usable-file priority. One identity context serves the entire walk.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Physical identity replaces the disproven literal boundary comparison.
 *   File-kind validation replaces name-only acceptance, without a special
 *   branch for a known path, test or consumer.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node resolve/dirname walk native paths, while the shared identity context
 *   handles actual case and physical aliases. A lexical child physically
 *   outside the workspace is not searched; file links are accepted when their
 *   resolved target is a regular file.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states priority, usable-file selection, unreadable-directory behavior
 *   and starts outside the physical boundary. Purpose, conditions and
 *   reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 */
export function findProjectConfig(
  start: string,
  stopAt?: string,
): string | undefined {
  let dir = path.resolve(start);
  const boundary = stopAt ? path.resolve(stopAt) : undefined;
  const identities = boundary ? createServerRootPathIdentityContext() : undefined;
  for (;;) {
    if (boundary && !identities!.isWithin(boundary, dir)) {
      return undefined;
    }
    const config = projectConfigIn(dir);
    if (config) {
      return config;
    }
    if (
      boundary &&
      identities!.resolve(dir).key === identities!.resolve(boundary).key
    ) {
      return undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

/**
 * Order resolution candidates with the active file first and workspace roots
 * afterward, deduplicating equal base/cwd pairs.
 *
 * The active file resolves modules from its directory but launches from its
 * nearest project or workspace root. Config discovery uses the same
 * workspace boundary policy as other callers.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node dirname and the owning project finder supply cwd/tsconfig decisions.
 *   A Set deduplicates literal base/cwd pairs while preserving input order;
 *   later root planning applies physical identity.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One push helper preserves candidate order and pair deduplication. The
 *   owning finder handles project discovery, while this function keeps editor
 *   priority and workspace fallback construction together.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Both active-file and workspace paths use the same usable-file finder;
 *   neither bypasses its physical boundary or patches module resolution.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node dirname preserves native paths. Later root planning uses shared
 *   physical identity and project discovery uses that same model for workspace
 *   boundaries. Candidate spelling remains native and is not converted into a
 *   protocol URI or lowercased by OS name.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates active-file module base from project cwd, describes
 *   ordered deduplication and identifies the discovery policy it inherits.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function createResolutionCandidates(
  input: ResolutionCandidateInput,
): ResolutionCandidate[] {
  const candidates: ResolutionCandidate[] = [];
  const seen = new Set<string>();
  const push = (candidate: ResolutionCandidate) => {
    const key = `${candidate.resolveFrom}\0${candidate.cwd}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  if (input.activeFile) {
    const resolveFrom = path.dirname(input.activeFile);
    const tsconfig = findProjectConfig(resolveFrom, input.activeWorkspaceRoot);
    push({
      cwd: tsconfig
        ? path.dirname(tsconfig)
        : (input.activeWorkspaceRoot ?? resolveFrom),
      resolveFrom,
      tsconfig,
    });
  }
  for (const root of input.workspaceRoots ?? []) {
    const tsconfig = findProjectConfig(root, root);
    push({
      cwd: tsconfig ? path.dirname(tsconfig) : root,
      resolveFrom: root,
      tsconfig,
    });
  }
  return candidates;
}

/**
 * Prepare the server stdio argument vector for a JavaScript, native or
 * Windows command-shim launcher.
 *
 * JavaScript uses the current Node executable; Windows .cmd/.bat uses an
 * explicitly quoted cmd payload and private argument environment. Other
 * executables retain ordinary argument vectors. The operation prepares data
 * without spawning.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node executable arguments and the documented server CLI carry cwd,
 *   selected project and root-owned command namespace. A necessary Windows
 *   command-shim boundary uses one environment expansion and explicit quoting
 *   rather than an ordinary shell string for all launchers.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   CLI arguments are assembled once. Launcher-kind branches only choose the
 *   executable representation; the Windows helper owns quoting and placeholders.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No launcher or global process method is patched.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The Windows command boundary selects ComSpec, cmd /d /s /c, quotes each
 *   argument and sets windowsVerbatimArguments. POSIX and Windows native
 *   executables use separate argument arrays; JavaScript uses
 *   process.execPath. Unicode, spaces and metacharacters remain argument
 *   values.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains JS/native/Windows-shim command preparation, stdio
 *   arguments, quoting ownership and that preparation does not spawn.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function createServerLaunchCommand(
  launcher: string,
  candidate: ResolutionCandidate,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): ServerLaunchCommand {
  const args = [
    "--stdio",
    "--cwd=" + candidate.cwd,
    "--suppress-execute-command-ids=" + WRAPPED_COMMAND_IDS.join(","),
    "--execute-command-id-prefix=" + executeCommandIDPrefix(candidate.cwd),
    ...(candidate.tsconfig ? ["--tsconfig=" + candidate.tsconfig] : []),
  ];
  if (isJavaScriptLauncher(launcher)) {
    return { command: process.execPath, args: [launcher, ...args] };
  }
  if (platform === "win32" && isWindowsCommandLauncher(launcher)) {
    const commandShim = createWindowsCommandShim([launcher, ...args]);
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", commandShim.payload],
      commandShimEnvironment: commandShim.environment,
      windowsVerbatimArguments: true,
    };
  }
  return { command: launcher, args };
}

/**
 * Combine a prepared launch command with its project cwd and toolchain
 * environment for vscode-languageclient.
 *
 * Command-shim environment and verbatim escaping are added only to the
 * Windows command boundary; ordinary launches retain Node argument escaping.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The supported LanguageClient Executable shape carries
 *   createServerLaunchCommand and serverProcessOptions results.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Command construction and project environment resolution remain separate
 *   helpers. This adapter only combines their results for the language client.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The Node-only verbatim option is structurally forwarded by the client to
 *   spawn; no client internals are replaced or global environment mutated.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Windows command-shim placeholders are merged into a copied environment
 *   with verbatim arguments. Native and JavaScript launchers retain argument
 *   arrays and the owning Node path resolution.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains project cwd/environment composition and limits verbatim
 *   escaping to the Windows command boundary. Purpose, conditions and reasons
 *   use separate native paragraphs under the documentation skill; member
 *   comments remain beside their fields.
 */

export function createServerExecutable(
  launcher: string,
  candidate: ResolutionCandidate,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): ServerExecutable {
  const launch = createServerLaunchCommand(launcher, candidate, platform, env);
  const options = serverProcessOptions(candidate.cwd);
  return {
    command: launch.command,
    args: launch.args,
    options:
      options && launch.windowsVerbatimArguments
        ? {
            ...options,
            env: { ...options.env, ...launch.commandShimEnvironment },
            windowsVerbatimArguments: true,
          }
        : options,
  };
}

/**
 * Construct a RelativePattern for all documents beneath a literal root.
 *
 * Using the constructor keeps glob metacharacters in the workspace path
 * literal rather than concatenating them into a glob.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The supported VS Code RelativePattern boundary receives the root as base
 *   and the recursive file glob separately.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One constructor call preserves the literal base boundary without a
 *   custom glob escaper or dependency on VS Code in this resolver module.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Constructor injection supplies the same interface without monkey patching
 *   VS Code.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   RelativePattern owns native base-path interpretation on Windows and
 *   POSIX. A filesystem root is not reinterpreted as a URI or escaped shell
 *   string.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the literal root and separate recursive glob, explaining
 *   why string concatenation would misinterpret root metacharacters. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function createDocumentSelectorPattern<T>(
  ctor: RelativePatternConstructor<T>,
  root: string,
): T {
  return new ctor(root, "**/*");
}

/**
 * Return this root's command namespace using the first 16 hex characters of
 * its identity hash.
 *
 * Both server arguments and middleware use the same prefix, so one client
 * does not apply another client's command replies.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node sha256 hashes the shared rootKey identity and the fixed ttsc.vscode
 *   protocol prefix.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single function defines the namespace used by launch arguments and
 *   middleware; neither caller maintains its own root hashing policy.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The prefix is a routing namespace, not a secret or an absolute collision
 *   guarantee; no fixture name or foreign dispatch mutation is used.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states the 16-hex-character identity-derived namespace and explains
 *   agreement between server arguments and middleware. Purpose, conditions
 *   and reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 */
export function executeCommandIDPrefix(root: string): string {
  const key = createHash("sha256")
    .update(rootKey(root))
    .digest("hex")
    .slice(0, 16);
  return `ttsc.vscode.${key}.`;
}

/**
 * Return a slash-separated absolute glob beneath the supplied root.
 *
 * This string helper is distinct from the production RelativePattern
 * constructor, which keeps the base literal. The caller supplies an absolute
 * root and owns any glob metacharacters in this string form.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node path.posix.join constructs the protocol-style glob after separator
 *   conversion.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It performs no filesystem access or writes and introduces no
 *   caller-specific or test-mode branch.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This compatibility helper only renders the caller-owned glob spelling;
 *   production document selection remains with the literal RelativePattern
 *   constructor boundary.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Backslashes are converted to forward slashes for the glob syntax. This is
 *   glob representation, not physical filesystem identity or a shell command.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states its absolute-root input and slash-separated string result,
 *   distinguishing caller-owned glob metacharacters from production
 *   RelativePattern selection. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 */

export function documentPattern(root: string): string {
  return path.posix.join(root.replace(/\\/g, "/"), "**/*");
}

/**
 * Prefer deeper candidate roots and retain the survivors in their original
 * resolution order.
 *
 * A selected child suppresses an ancestor candidate so the active nested
 * package keeps its own server; identity aliases also collapse.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Sorting physical roots deepest-first ensures a selected descendant
 *   suppresses its containing ancestor, including aliases with different
 *   lexical lengths. Filtering the original array preserves caller priority.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Selection owns depth preference and containment; the identity context owns
 *   alias resolution. A final filter restores input order without introducing
 *   a second routing policy.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains deeper-root preference, alias collapse and restoration of
 *   survivor resolution order. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 */
export function filterNonOverlappingCandidates(
  candidates: readonly ResolutionCandidate[],
): ResolutionCandidate[] {
  const identities = createServerRootPathIdentityContext();
  return filterCandidatesByPhysicalRoots(
    candidates,
    identities,
    process.platform,
  );
}

/**
 * Plan unique nonoverlapping roots, preferring a supplied root before depth
 * and identity ordering.
 *
 * Physical aliases collapse. A preferred ancestor may suppress descendants;
 * without that preference deeper roots win. The returned list performs no
 * client startup or teardown.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Map keys deduplicate equivalent roots while preserving the first spelling.
 *   The preferred root is selected before depth ordering, then each overlapping
 *   candidate is omitted, so the result has no ancestor/descendant pair.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Deduplication, ordering and conflict selection are explicit phases in one
 *   pure planner; client startup and shutdown stay with the extension.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes preferred-root precedence from ordinary depth
 *   ordering, alias collapse and the absence of client lifecycle effects.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function planNonOverlappingClientRoots(
  roots: readonly string[],
  preferredRoot?: string,
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): string[] {
  return planRootsByPhysicalIdentity(roots, preferredRoot, identities, platform);
}

/**
 * Select the deepest containing root for a file, or undefined when none
 * contains it.
 *
 * Routing must use filesystem containment rather than string prefixes that
 * confuse sibling names or physical aliases.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared identity context owns containment and resolved key depth
 *   comparison.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single scan retains the best containing root; containment and resolved
 *   identity remain in the shared context rather than separate prefix logic.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Iteration returns a caller root spelling without mutating root arrays or
 *   applying consumer-specific exceptions.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states deepest containing-root selection and undefined absence,
 *   explaining why sibling string prefixes are insufficient. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function selectDeepestRootForPath(
  file: string,
  roots: readonly string[],
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): string | undefined {
  let selected: string | undefined;
  for (const root of roots) {
    if (!isPathInsideRoot(file, root, platform, identities)) {
      continue;
    }
    if (
      !selected ||
      rootKey(root, platform, identities).length >
        rootKey(selected, platform, identities).length
    ) {
      selected = root;
    }
  }
  return selected;
}

/**
 * Return whether the file lies within the root under the supplied filesystem
 * identity context.
 *
 * Containment includes the root itself and handles physical aliases; a
 * shared context keeps one routing decision internally consistent.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The maintained identity.isWithin API owns this relation. Explicit context
 *   injection reuses the filesystem model rather than maintaining an
 *   independent case-folding or prefix algorithm.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The wrapper translates argument order to the owning identity API and
 *   exposes context injection without maintaining another containment policy.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states root-inclusive shared-identity containment and physical
 *   aliases, explaining the consistent context boundary. Purpose, conditions
 *   and reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 */
export function isPathInsideRoot(
  file: string,
  root: string,
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): boolean {
  return identities.isWithin(root, file);
}

/**
 * Return whether either filesystem root contains the other.
 *
 * Equivalent aliases and ancestor/descendant roots overlap; sibling path
 * prefixes alone do not.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Roots overlap exactly when either contains the other, including equality.
 *   Both directional checks use the same identity observations.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Symmetric overlap is composed from the single containment predicate;
 *   callers need not duplicate alias or ancestor policies.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes aliases and ancestor/descendant containment from
 *   similarly spelled sibling prefixes. Purpose, conditions and reasons use
 *   separate native paragraphs under the documentation skill; member comments
 *   remain beside their fields.
 */
export function rootsOverlap(
  left: string,
  right: string,
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): boolean {
  return (
    isPathInsideRoot(left, right, platform, identities) ||
    isPathInsideRoot(right, left, platform, identities)
  );
}

/**
 * Select existing client roots that overlap the target root.
 *
 * Conflicting clients must be stopped before the target starts; this helper
 * computes the set without stopping clients itself.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Filtering by the symmetric overlap predicate includes equal roots and
 *   both ancestor directions, which identifies every existing client that
 *   would conflict with the target.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This selector computes only the conflict set. The extension owns stopping
 *   clients, and rootsOverlap remains the sole overlap definition.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains overlap selection and why conflicting clients must stop
 *   before target startup; this helper computes the set only. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function rootsToStopForTarget(
  roots: readonly string[],
  target: string,
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): string[] {
  return roots.filter((root) =>
    rootsOverlap(root, target, platform, identities),
  );
}

/**
 * Select existing roots whose filesystem identity is absent from the
 * complete planned-root set.
 *
 * An empty plan selects every existing root for teardown. Identity aliases
 * already present in the plan remain active.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A set of planned physical keys implements exact plan membership. Existing
 *   aliases share those keys, and an empty set selects every existing root.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Key construction and membership filtering express teardown selection
 *   directly; process stopping stays outside the planner.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains identity-based plan membership, empty-plan teardown and
 *   retention of equivalent planned aliases. Purpose, conditions and reasons
 *   use separate native paragraphs under the documentation skill; member
 *   comments remain beside their fields.
 */
export function rootsToStopForPlan(
  roots: readonly string[],
  plannedRoots: readonly string[],
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): string[] {
  const plannedKeys = new Set(
    plannedRoots.map((root) => rootKey(root, platform, identities)),
  );
  return roots.filter(
    (root) => !plannedKeys.has(rootKey(root, platform, identities)),
  );
}

/**
 * Select client roots physically contained by a removed workspace root.
 *
 * Removing a workspace must stop its descendants while retaining sibling
 * workspace clients.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Filtering root-inclusive containment selects clients inside the removed
 *   physical workspace while preserving siblings outside that relation.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The selector delegates containment and leaves lifecycle changes to the
 *   extension, so workspace removal has no second path comparison policy.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains physical containment for workspace removal and retention
 *   of sibling workspace clients. Purpose, conditions and reasons use
 *   separate native paragraphs under the documentation skill; member comments
 *   remain beside their fields.
 */
export function rootsInsideRemovedWorkspace(
  roots: readonly string[],
  removedRoot: string,
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): string[] {
  return roots.filter((root) =>
    isPathInsideRoot(root, removedRoot, platform, identities),
  );
}

/**
 * Return the shared filesystem identity key for a client root.
 *
 * Routing, command namespaces and deduplication use one identity model
 * rather than platform-wide lowercasing.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The maintained identity.resolve API supplies the key, including configured
 *   unresolved-path behavior. This wrapper changes neither the filesystem nor
 *   foreign resolver methods.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This wrapper exposes the context's identity key unchanged; routing and
 *   command namespace callers share one identity definition.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies shared filesystem identity across routing, command
 *   namespaces and deduplication instead of platform-wide lowercasing.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function rootKey(
  root: string,
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): string {
  return identities.resolve(root).key;
}

function projectConfigIn(dir: string): string | undefined {
  try {
    const matches = fs
      .readdirSync(dir)
      .filter((name) => PROJECT_CONFIG_PATTERN.test(name))
      .sort(compareProjectConfigNames);
    for (const name of matches) {
      const candidate = path.join(dir, name);
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // A dangling or unreadable candidate must not suppress a usable sibling.
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function compareProjectConfigNames(left: string, right: string): number {
  const priority = (name: string): number => {
    if (name === "tsconfig.json") return 0;
    if (/^tsconfig\..*\.json$/.test(name)) return 1;
    if (name === "jsconfig.json") return 2;
    return 3;
  };
  return priority(left) - priority(right) || left.localeCompare(right);
}

function isJavaScriptLauncher(launcher: string): boolean {
  return [".js", ".cjs", ".mjs"].includes(path.extname(launcher));
}

function isWindowsCommandLauncher(launcher: string): boolean {
  return [".cmd", ".bat"].includes(path.extname(launcher).toLowerCase());
}

function createWindowsCommandShim(args: readonly string[]): {
  environment: NodeJS.ProcessEnv;
  payload: string;
} {
  const prefix = "TTSC_VSCODE_COMMAND_SHIM_ARG_";
  const environment = Object.fromEntries(
    args.map((arg, index) => [prefix + index, quoteWindowsArg(arg)]),
  );
  return {
    environment,
    // cmd expands every placeholder exactly once. The environment values are
    // already Windows-command-line arguments, so their literal `%` segments do
    // not expand again and their quotes continue to protect shell metacharacters.
    payload: `"${args.map((_, index) => `%${prefix}${index}%`).join(" ")}"`,
  };
}

function quoteWindowsArg(arg: string): string {
  return `"${String(arg)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\*)$/, "$1$1")}"`;
}

/**
 * Resolve the project TypeScript installation's platform package and return
 * its existing native tsc binary, or undefined.
 *
 * The language server needs the project-owned TypeScript-Go build rather
 * than whichever binary appears on PATH. Missing packages and unreadable
 * resolution return no override.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node createRequire resolves the exported TypeScript package anchor and its
 *   supported platform package.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Package-anchor resolution and native-binary selection are one lookup;
 *   callers receive only an override path or absence, never package internals.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The package naming and lib/tsc location are the existing TypeScript
 *   distribution contract; the lookup reads existence without running or
 *   patching a compiler.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   process.platform/process.arch select the native package and Windows
 *   tsc.exe versus POSIX tsc. Node join/dirname preserve native paths, with
 *   no shell PATH search or filename quoting.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the project-owned platform package, existing native
 *   binary and undefined missing/unreadable result instead of ambient PATH
 *   selection. Purpose, conditions and reasons use separate native paragraphs
 *   under the documentation skill; member comments remain beside their
 *   fields.
 */

export function resolveTsgoBinary(base: string): string | undefined {
  try {
    const requireFromBase = createRequire(
      path.join(base, "__ttsc_vscode_resolve__.cjs"),
    );
    const packageJson = requireFromBase.resolve("typescript/package.json");
    const packageRoot = path.dirname(packageJson);
    const requireFromTsgo = createRequire(
      path.join(packageRoot, "__ttsc_vscode_resolve__.cjs"),
    );
    const platformPackage = `@typescript/typescript-${process.platform}-${process.arch}`;
    const platformPackageJson = requireFromTsgo.resolve(
      `${platformPackage}/package.json`,
    );
    const binary = path.join(
      path.dirname(platformPackageJson),
      "lib",
      process.platform === "win32" ? "tsc.exe" : "tsc",
    );
    return fs.existsSync(binary) ? binary : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Prepare project cwd and inherited environment, adding TTSC_TSGO_BINARY
 * when project binary resolution succeeds.
 *
 * An absent or empty cwd returns undefined. No resolved binary leaves
 * inherited environment unchanged so the launcher owns its normal fallback;
 * the global environment is never assigned here.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The owning resolveTsgoBinary operation supplies a toolchain override and
 *   object spread copies the environment when needed. This uses Node spawn
 *   options instead of rewriting process.env or patching the language-client
 *   launcher.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter owns cwd and the conditional toolchain override while binary
 *   discovery remains with resolveTsgoBinary. It never mutates process.env.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node process environment and native resolved binary path feed the child
 *   directly. Ordinary process arguments are prepared separately; no
 *   environment value is interpolated into a shell command here.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states absent-cwd meaning, inherited-environment copying,
 *   conditional toolchain override and preservation of launcher fallback.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */

export function serverProcessOptions(
  cwd?: string,
): ServerProcessOptions | undefined {
  if (!cwd) {
    return undefined;
  }
  const tsgo = resolveTsgoBinary(cwd);
  return {
    cwd,
    env: tsgo
      ? {
          ...process.env,
          TTSC_TSGO_BINARY: tsgo,
        }
      : process.env,
  };
}
