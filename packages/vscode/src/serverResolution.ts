import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  type FilesystemPathIdentityContext,
  type FilesystemPathIdentityOperations,
  createFilesystemPathIdentityContext,
} from "ttsc/path-identity";

/**
 * A module-resolution base, server working directory and optional selected
 * project config.
 *
 * Resolution and server cwd may differ when an active file lives below its
 * project root.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   The TypeScript structural type ResolutionCandidate represents a
 *   module-resolution base, server working directory and optional selected
 *   project config. It declares values and optional states without executable
 *   branches, fixture-specific decisions, foreign mutation or a competing
 *   runtime implementation.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   This declaration contains no filesystem or process operations. Protocol
 *   strings and numbers remain values; native paths are handled by their
 *   owning resolver and editor URIs by VS Code.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The inspected candidate builder pairs a module-resolution base with the
 *   server cwd and optional discovered config, allowing an active file
 *   directory to resolve modules while launching from its project.
 *   Workspace-only candidates omit config when absent. The type does not
 *   enforce discovery; findProjectConfig has reproduced boundary-alias and
 *   config-entry-kind defects recorded in the adoption findings, inherited by
 *   candidates that use it.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc distinguishes native module-resolution base, server cwd and
 *   optional config; the type comment explains why base and cwd can differ.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The TypeScript structural type ResolutionCandidateInput represents
 *   optional active file, owning workspace root and workspace roots used to
 *   order resolution candidates. It declares values and optional states
 *   without executable branches, fixture-specific decisions, foreign mutation
 *   or a competing runtime implementation.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   This declaration contains no filesystem or process operations. Protocol
 *   strings and numbers remain values; native paths are handled by their
 *   owning resolver and editor URIs by VS Code.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   An absent active file selects workspace-only resolution, while an active
 *   file can use an optional owning workspace boundary before workspace
 *   fallbacks. createResolutionCandidates owns ordering and base/cwd
 *   deduplication. Inspection and existing resolution cases establish that
 *   consumer behavior; its underlying finder has recorded alias and
 *   directory-candidate defects, which the optional fields cannot prevent.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains optional active-file and workspace-boundary inputs
 *   and ordered workspace fallbacks; the type comment states absent-input
 *   meaning. Purpose, conditions and reasons use separate native paragraphs
 *   under the documentation skill; member comments remain beside their
 *   fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The maintained ttsc/path-identity API owns filesystem equivalence instead
 *   of a second lowercase/prefix approximation. Explicit operation injection
 *   is the supported observation boundary, with throwOnRealpathError
 *   defaulting to false.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The inspected factory delegates to the shared path-identity
 *   implementation, retaining conservative lexical identity when physical
 *   resolution fails and accepting injected operations through an explicit
 *   boundary. Root routing consumes one context for a decision. Existing
 *   identity and nested-root cases exercise these consumers; this does not
 *   make the separate literal-boundary config finder identity-aware.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains conservative lexical fallback and explicit injected
 *   identity operations, including why globals are not replaced. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The TypeScript structural type ServerProcessOptions represents node spawn
 *   options with a working directory, environment and optional verbatim
 *   windows arguments. It declares values and optional states without
 *   executable branches, fixture-specific decisions, foreign mutation or a
 *   competing runtime implementation.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   These fields describe a native process boundary: Node argument vectors on
 *   ordinary launchers and explicit Windows cmd payload/environment for
 *   command shims. The type does not invoke the process itself.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The language-client consumer receives cwd, an environment snapshot and an
 *   optional verbatim-arguments flag. Inspection of createServerExecutable
 *   sets that flag only for prepared Windows command shims; ordinary
 *   executable launches retain Node escaping. Existing launch cases cover
 *   these shapes. The type cannot ensure that an arbitrary caller supplied a
 *   correctly quoted shim payload.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains cwd, environment and optional Windows verbatim
 *   arguments; the type comment limits that flag to prequoted shim payloads.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The TypeScript structural type ServerLaunchCommand represents an
 *   executable name and argument vector, with optional windows command-shim
 *   environment and verbatim flag. It declares values and optional states
 *   without executable branches, fixture-specific decisions, foreign mutation
 *   or a competing runtime implementation.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   These fields describe a native process boundary: Node argument vectors on
 *   ordinary launchers and explicit Windows cmd payload/environment for
 *   command shims. The type does not invoke the process itself.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The command and argument vector describe one of the supported JS, native
 *   or Windows shim launch paths. createServerLaunchCommand owns stdio
 *   arguments and command-shim environment/quoting, and
 *   createServerExecutable carries them into the language client. Existing
 *   launcher cases exercise that boundary; declaring a string command alone
 *   does not establish an executable is present.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc describes executable, vector, shim environment and verbatim
 *   state; the type comment separates JS, native and command-shim boundaries.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The TypeScript structural type ServerExecutable represents the launch
 *   command, argument vector and optional process options passed to the
 *   language client. It declares values and optional states without
 *   executable branches, fixture-specific decisions, foreign mutation or a
 *   competing runtime implementation.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   These fields describe a native process boundary: Node argument vectors on
 *   ordinary launchers and explicit Windows cmd payload/environment for
 *   command shims. The type does not invoke the process itself.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The prepared command, args and optional process options match the
 *   language-client executable boundary. Inspection confirms cwd and
 *   toolchain environment are preserved, with undefined options retaining
 *   client defaults and shim additions applied only at their launch boundary.
 *   Existing server-launch cases exercise its producer. This structure
 *   performs no spawn and cannot guarantee the child starts successfully.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc describes the language-client command, vector and optional
 *   prepared options; the type comment explains client defaults and project
 *   environment ownership. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The TypeScript structural type ClientRootSelection represents a file and
 *   the selected client root as filesystem paths. It declares values and
 *   optional states without executable branches, fixture-specific decisions,
 *   foreign mutation or a competing runtime implementation.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The file and root are native filesystem paths, not editor URIs.
 *   selectDeepestRootForPath and the shared ttsc/path-identity context
 *   interpret containment, physical aliases and host filesystem case rules.
 *   This type stores that boundary without normalizing paths itself.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The fields identify a native file and chosen client root for routing,
 *   rather than an editor URI or write permission. selectDeepestRootForPath
 *   and shared containment operations establish routing under the supplied
 *   identity context. Existing nested-root and alias cases exercise those
 *   operations; this type alone cannot assert that the file is contained by
 *   the chosen root.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc identifies native file/root paths; the type comment
 *   distinguishes routing input from editor URI identity and write
 *   permission. Purpose, conditions and reasons use separate native
 *   paragraphs under the documentation skill; member comments remain beside
 *   their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The TypeScript structural type RelativePatternConstructor represents the
 *   vs code relativepattern constructor accepting a literal base and a glob
 *   beneath it. It declares values and optional states without executable
 *   branches, fixture-specific decisions, foreign mutation or a competing
 *   runtime implementation.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The base is a literal native workspace path;
 *   createDocumentSelectorPattern passes the recursive glob separately so
 *   root metacharacters are not interpreted as glob syntax. VS Code owns
 *   platform-specific RelativePattern matching. This signature neither joins
 *   separators manually nor equates a native path with a protocol URI.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   This constructor boundary keeps the workspace base literal and interprets
 *   only the separate recursive pattern as a glob.
 *   createDocumentSelectorPattern supplies those two values rather than
 *   concatenating a metacharacter-containing root into glob syntax.
 *   Inspection and existing selector cases establish the producer behavior;
 *   this signature represents the VS Code API rather than implementing glob
 *   parsing.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the literal native base and separate glob, explaining
 *   why workspace metacharacters must remain literal. Purpose, conditions and
 *   reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Node createRequire resolves the workspace-owned exported package anchor;
 *   fs reads the bin declaration and checks the resolved launcher. The
 *   existing legacy path is a package compatibility default, not a
 *   fixture-specific workaround. This operation neither executes the launcher
 *   nor patches module resolution.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   Node createRequire, dirname/join/resolve and existsSync retain native
 *   package paths on Windows and POSIX. No file path is parsed as a URL or
 *   interpolated into a command.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection resolves the project package.json anchor, reads its
 *   bin.ttscserver entry and returns an existing launcher. The legacy path is
 *   used only without a string manifest entry; resolution/read failures
 *   return undefined. Existing launcher cases cover package ownership and
 *   missing candidates. Existence is the present acceptance check, not a
 *   guarantee of child startup or executable permissions.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states project package-anchor ownership, bin manifest selection,
 *   legacy-path conditions and undefined resolution/read failure. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * This wrapper delegates discovery instead of maintaining a second policy.
 * The finder currently has unresolved workspace-alias and config-entry-kind
 * defects recorded in the adoption findings.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   Node dirname projects the owning finder result to a root, retaining
 *   undefined absence. This wrapper adds no consumer-specific branch or
 *   foreign mutation; its result inherits the finder defects and does not
 *   certify physical boundary or file-kind validity.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   Node dirname handles native roots and separators. Physical alias and
 *   case-boundary correctness depends on the finder and remains unresolved;
 *   no cross-platform correctness claim is made for that boundary.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection delegates to findProjectConfig and returns its selected
 *   directory or undefined, preserving one discovery policy. The read-only
 *   probes reproduced a case-alias workspace-boundary escape and selection of
 *   a config-named directory in that finder. Both are recorded in
 *   .wiki/evidence-adoption/findings.md; this wrapper inherits the defects
 *   and is not certified as finding a usable bounded project.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states delegation and undefined absence, and explicitly identifies
 *   the finder defects inherited by this wrapper. Purpose, conditions and
 *   reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 *
 */

export function findProjectRoot(
  start: string,
  stopAt?: string,
): string | undefined {
  const config = findProjectConfig(start, stopAt);
  return config ? path.dirname(config) : undefined;
}

/**
 * Walk upward for the nearest tsconfig/jsconfig-named directory entry,
 * stopping at the literal optional boundary spelling.
 *
 * Canonical tsconfig.json wins over tsconfig variants, then jsconfig.json
 * and variants. Unreadable directories yield no candidate. Boundary aliases
 * and config-named directories are unresolved defects; this description
 * records current behavior rather than promising usable-file selection.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   Node readdir and path.dirname implement the upward walk without foreign
 *   mutation or test-mode branches. Literal boundary equality is disproven by
 *   a Windows workspace case alias; name-only selection is disproven by a
 *   config-named directory. Both causes are recorded in the adoption findings
 *   for separate repair. No workaround or claimed correction is added here.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   Node resolve/dirname handle native path roots, but the literal boundary
 *   comparison does not preserve filesystem alias identity on Windows. The
 *   reproduced escape is deferred in the adoption findings rather than
 *   certified as portable behavior.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection shows canonical-name precedence, sorted variants,
 *   unreadable-directory continuation and a literal string boundary stop.
 *   Read-only probes reproduced crossing a Windows case-alias workspace
 *   boundary and accepting a tsconfig-named directory ahead of a usable
 *   config variant. Both findings are recorded in
 *   .wiki/evidence-adoption/findings.md for deferred repair. Existing feature
 *   cases passed but do not discharge these newly reproduced defects.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states nearest-ancestor/name priority and unreadable-directory
 *   behavior, explicitly distinguishing the unresolved literal-boundary and
 *   entry-kind defects from usable-file selection. Purpose, conditions and
 *   reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 *
 */
export function findProjectConfig(
  start: string,
  stopAt?: string,
): string | undefined {
  let dir = path.resolve(start);
  const boundary = stopAt ? path.resolve(stopAt) : undefined;
  for (;;) {
    const config = projectConfigIn(dir);
    if (config) {
      return config;
    }
    if (boundary && dir === boundary) {
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Node dirname and the owning project finder supply cwd/tsconfig decisions.
 *   A Set deduplicates literal base/cwd pairs while preserving input order;
 *   later root planning applies physical identity. The finder's recorded
 *   boundary and file-kind defects remain unresolved, not bypassed by
 *   candidate construction. No foreign APIs are changed.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   Node dirname preserves native paths. Later root planning uses shared
 *   physical identity, but project discovery still has the separately
 *   recorded Windows alias boundary defect; this acknowledgment does not
 *   claim that downstream planning corrects selection.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection orders active-file resolution before workspace fallbacks,
 *   preserves separate module base and server cwd, and deduplicates equal
 *   base/cwd pairs. Existing candidate cases cover ordinary discovery. The
 *   config finder used here has reproduced alias-boundary and
 *   directory-candidate defects recorded in the adoption findings, so
 *   affected active-file project selection remains unresolved rather than
 *   repaired by deduplication.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates active-file module base from project cwd, describes
 *   ordered deduplication and identifies the discovery policy it inherits.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Node executable arguments and the documented server CLI carry cwd,
 *   selected project and root-owned command namespace. A necessary Windows
 *   command-shim boundary uses one environment expansion and explicit quoting
 *   rather than an ordinary shell string for all launchers. No launcher or
 *   global process method is patched.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The Windows command boundary selects ComSpec, cmd /d /s /c, quotes each
 *   argument and sets windowsVerbatimArguments. POSIX and Windows native
 *   executables use separate argument arrays; JavaScript uses
 *   process.execPath. Unicode, spaces and metacharacters remain argument
 *   values.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection prepares stdio arguments for JS via process.execPath, native
 *   launchers via an ordinary argument vector and Windows cmd/bat through a
 *   quoted cmd payload and private argument environment. Existing quoting and
 *   launcher cases exercise that consumer boundary. The helper prepares a
 *   command without spawning it; the language client owns startup failures.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains JS/native/Windows-shim command preparation, stdio
 *   arguments, quoting ownership and that preparation does not spawn.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The supported LanguageClient Executable shape carries
 *   createServerLaunchCommand and serverProcessOptions results. The Node-only
 *   verbatim option is structurally forwarded by the client to spawn; no
 *   client internals are replaced or global environment mutated.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   Windows command-shim placeholders are merged into a copied environment
 *   with verbatim arguments. Native and JavaScript launchers retain argument
 *   arrays and the owning Node path resolution.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection combines the prepared launch with the requested cwd and
 *   project toolchain environment, merging shim-specific environment and
 *   verbatim handling only when supplied by the command boundary. Existing
 *   executable/launch cases cover those combinations. The language client
 *   owns actual spawn and failure handling; this producer does not claim that
 *   a prepared executable has already run.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains project cwd/environment composition and limits verbatim
 *   escaping to the Windows command boundary. Purpose, conditions and reasons
 *   use separate native paragraphs under the documentation skill; member
 *   comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The supported VS Code RelativePattern boundary receives the root as base
 *   and the recursive file glob separately. Constructor injection supplies
 *   the same interface without monkey patching VS Code.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   RelativePattern owns native base-path interpretation on Windows and
 *   POSIX. A filesystem root is not reinterpreted as a URI or escaped shell
 *   string.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection passes the literal root and a separate recursive file glob to
 *   the provided RelativePattern constructor. Existing metacharacter-root
 *   cases cover the distinction from concatenated globs. This selects
 *   documents for a client without granting edit permission or deciding
 *   filesystem containment itself.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the literal root and separate recursive glob, explaining
 *   why string concatenation would misinterpret root metacharacters. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Node sha256 hashes the shared rootKey identity and the fixed ttsc.vscode
 *   protocol prefix. The prefix is a routing namespace, not a secret or an
 *   absolute collision guarantee; no fixture name or foreign dispatch
 *   mutation is used.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection hashes the shared root identity and returns its first 16
 *   hexadecimal characters as the command namespace. Server launch arguments
 *   and command middleware consume the same helper, and existing multi-root
 *   cases exercise namespace routing. This is a routing prefix, not a
 *   cryptographic uniqueness or authorization guarantee.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states the 16-hex-character identity-derived namespace and explains
 *   agreement between server arguments and middleware. Purpose, conditions
 *   and reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Node path.posix.join constructs the protocol-style glob after separator
 *   conversion. It performs no filesystem access or writes and introduces no
 *   caller-specific or test-mode branch.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   Backslashes are converted to forward slashes for the glob syntax. This is
 *   glob representation, not physical filesystem identity or a shell command.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection normalizes root separators and adds the recursive file suffix;
 *   the caller must supply an absolute root and owns metacharacters in this
 *   string form. Production document selection instead uses RelativePattern
 *   with a literal base. Existing pattern cases cover the helper spelling,
 *   without establishing that arbitrary root text is safely escaped as a
 *   glob.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states its absolute-root input and slash-separated string result,
 *   distinguishing caller-owned glob metacharacters from production
 *   RelativePattern selection. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Array, Set and Map operations select from caller values without mutating
 *   the supplied collection or patching foreign methods. Decisions follow the
 *   documented root policy rather than consumer names or test mode.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection prefers deeper candidate roots, suppresses conflicting
 *   ancestors and aliases, then restores surviving candidates to original
 *   resolution order. Existing nested-root and alias cases exercise the
 *   shared identity consumer. It computes a plan without launching clients or
 *   validating the candidate finder defects recorded separately.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains deeper-root preference, alias collapse and restoration of
 *   survivor resolution order. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 *
 */
export function filterNonOverlappingCandidates(
  candidates: readonly ResolutionCandidate[],
): ResolutionCandidate[] {
  const identities = createServerRootPathIdentityContext();
  const sorted = [...candidates].sort(
    (left, right) =>
      path.resolve(right.cwd).length - path.resolve(left.cwd).length,
  );
  const selected: ResolutionCandidate[] = [];
  for (const candidate of sorted) {
    if (
      selected.some((entry) =>
        isPathInsideRoot(
          entry.cwd,
          candidate.cwd,
          process.platform,
          identities,
        ),
      )
    ) {
      continue;
    }
    selected.push(candidate);
  }
  return selected.sort(
    (left, right) =>
      candidates.indexOf(left as ResolutionCandidate) -
      candidates.indexOf(right as ResolutionCandidate),
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Array, Set and Map operations select from caller values without mutating
 *   the supplied collection or patching foreign methods. Decisions follow the
 *   documented root policy rather than consumer names or test mode.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection deduplicates physical identities and lets a supplied preferred
 *   root win before depth and deterministic identity ordering. Without that
 *   preference, deeper nonoverlapping roots survive; a preferred ancestor may
 *   intentionally suppress children. Existing preferred-root and nested-root
 *   cases exercise these distinctions. The result owns no process lifecycle
 *   by itself.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes preferred-root precedence from ordinary depth
 *   ordering, alias collapse and the absence of client lifecycle effects.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
 */
export function planNonOverlappingClientRoots(
  roots: readonly string[],
  preferredRoot?: string,
  platform: NodeJS.Platform = process.platform,
  identities: FilesystemPathIdentityContext = createServerRootPathIdentityContext(
    platform,
  ),
): string[] {
  const unique = new Map<string, string>();
  for (const root of roots) {
    const key = rootKey(root, platform, identities);
    if (!unique.has(key)) {
      unique.set(key, root);
    }
  }
  const preferredKey = preferredRoot
    ? rootKey(preferredRoot, platform, identities)
    : undefined;
  const ordered: string[] = [];
  if (preferredKey && unique.has(preferredKey)) {
    ordered.push(unique.get(preferredKey)!);
    unique.delete(preferredKey);
  }
  ordered.push(
    ...[...unique.values()].sort((left, right) => {
      const depth = pathDepth(right, platform) - pathDepth(left, platform);
      return (
        depth ||
        rootKey(left, platform, identities).localeCompare(
          rootKey(right, platform, identities),
        )
      );
    }),
  );
  const selected: string[] = [];
  for (const root of ordered) {
    if (
      selected.some((entry) => rootsOverlap(entry, root, platform, identities))
    ) {
      continue;
    }
    selected.push(root);
  }
  return selected;
}

/**
 * Select the deepest containing root for a file, or undefined when none
 * contains it.
 *
 * Routing must use filesystem containment rather than string prefixes that
 * confuse sibling names or physical aliases.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   The shared identity context owns containment and resolved key depth
 *   comparison. Iteration returns a caller root spelling without mutating
 *   root arrays or applying consumer-specific exceptions.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection filters by shared filesystem containment and selects the
 *   deepest containing root, returning undefined when none qualifies.
 *   Existing sibling-prefix, alias and nested-root cases cover adjacent
 *   negatives and the deepest selection. This does not use a lexical
 *   startsWith shortcut or perform editor writes.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states deepest containing-root selection and undefined absence,
 *   explaining why sibling string prefixes are insufficient. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The maintained identity.isWithin API owns this relation. Explicit context
 *   injection reuses the filesystem model rather than maintaining an
 *   independent case-folding or prefix algorithm.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection delegates containment, including root equality and physical
 *   aliases, to one supplied shared identity context. Existing sibling-prefix
 *   and alias cases exercise the root routing consumer. Unresolvable physical
 *   paths follow that context conservative lexical behavior rather than
 *   claiming a physical identity was observed.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states root-inclusive shared-identity containment and physical
 *   aliases, explaining the consistent context boundary. Purpose, conditions
 *   and reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Two calls to the owning containment operation use one identity context.
 *   Boolean composition does not mutate roots, patch the resolver or branch
 *   for tests.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection asks whether either root contains the other under the same
 *   identity context. Equal identities and ancestor/descendant pairs overlap;
 *   similarly spelled sibling prefixes do not. Existing routing cases
 *   exercise those positive and negative boundaries. The predicate selects
 *   conflicts without stopping any client itself.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes aliases and ancestor/descendant containment from
 *   similarly spelled sibling prefixes. Purpose, conditions and reasons use
 *   separate native paragraphs under the documentation skill; member comments
 *   remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Array, Set and Map operations select from caller values without mutating
 *   the supplied collection or patching foreign methods. Decisions follow the
 *   documented root policy rather than consumer names or test mode.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection selects existing roots overlapping the target under shared
 *   identity. Existing root-reconciliation cases cover alias and ancestor
 *   conflicts while unrelated siblings remain active. The caller stops
 *   selected clients before startup; this helper returns the set and performs
 *   no teardown or rollback.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains overlap selection and why conflicting clients must stop
 *   before target startup; this helper computes the set only. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Array, Set and Map operations select from caller values without mutating
 *   the supplied collection or patching foreign methods. Decisions follow the
 *   documented root policy rather than consumer names or test mode.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection compares existing root identities with the complete planned
 *   set, retaining equivalent planned aliases and selecting every existing
 *   root for an empty plan. Existing reconciliation cases exercise these
 *   transitions. It plans teardown without asserting that later asynchronous
 *   stops or starts succeed.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains identity-based plan membership, empty-plan teardown and
 *   retention of equivalent planned aliases. Purpose, conditions and reasons
 *   use separate native paragraphs under the documentation skill; member
 *   comments remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Array, Set and Map operations select from caller values without mutating
 *   the supplied collection or patching foreign methods. Decisions follow the
 *   documented root policy rather than consumer names or test mode.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection selects client roots contained by the removed workspace under
 *   shared identity, retaining sibling workspace roots. Existing
 *   workspace-removal and root-containment cases cover the selection.
 *   Extension event handling owns subsequent stop operations; this helper
 *   does not mutate the client map.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains physical containment for workspace removal and retention
 *   of sibling workspace clients. Purpose, conditions and reasons use
 *   separate native paragraphs under the documentation skill; member comments
 *   remain beside their fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The maintained identity.resolve API supplies the key, including
 *   configured unresolved-path behavior. This wrapper changes neither the
 *   filesystem nor foreign resolver methods.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   The shared ttsc/path-identity context handles physical aliases and host
 *   filesystem case rules, including Windows directory case sensitivity. Node
 *   paths preserve native roots and separators; no shell or URL comparison
 *   substitutes for filesystem identity.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection returns the shared filesystem identity key used by
 *   deduplication, command namespaces and routing. Existing alias and
 *   root-selection cases exercise those consumers. Conservative lexical
 *   fallback is retained when realpath is unavailable; this helper does not
 *   prove that two unresolved paths refer to the same physical resource.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies shared filesystem identity across routing, command
 *   namespaces and deduplication instead of platform-wide lowercasing.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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

function pathDepth(value: string, platform: NodeJS.Platform): number {
  const pathApi = platform === "win32" ? path.win32 : path;
  return pathApi
    .resolve(value)
    .split(platform === "win32" ? path.win32.sep : path.sep)
    .filter(Boolean).length;
}

function projectConfigIn(dir: string): string | undefined {
  try {
    const match = fs
      .readdirSync(dir)
      .filter((name) => PROJECT_CONFIG_PATTERN.test(name))
      .sort(compareProjectConfigNames)[0];
    return match ? path.join(dir, match) : undefined;
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   Node createRequire resolves the exported TypeScript package anchor and
 *   its supported platform package. The package naming and lib/tsc location
 *   are the existing TypeScript distribution contract; the lookup reads
 *   existence without running or patching a compiler.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   process.platform/process.arch select the native package and Windows
 *   tsc.exe versus POSIX tsc. Node join/dirname preserve native paths, with
 *   no shell PATH search or filename quoting.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection resolves the project TypeScript installation and its selected
 *   platform package, returning its existing native tsc binary or undefined
 *   on missing/unreadable resolution. Existing toolchain-resolution cases
 *   exercise project ownership instead of PATH selection. It does not spawn
 *   the result or establish executable permissions through an existence
 *   check.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the project-owned platform package, existing native
 *   binary and undefined missing/unreadable result instead of ambient PATH
 *   selection. Purpose, conditions and reasons use separate native paragraphs
 *   under the documentation skill; member comments remain beside their
 *   fields.
 *
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   The owning resolveTsgoBinary operation supplies a toolchain override and
 *   object spread copies the environment when needed. This uses Node spawn
 *   options instead of rewriting process.env or patching the language-client
 *   launcher.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   Node process environment and native resolved binary path feed the child
 *   directly. Ordinary process arguments are prepared separately; no
 *   environment value is interpolated into a shell command here.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   Inspection returns undefined for absent or empty cwd, otherwise snapshots
 *   inherited environment and adds TTSC_TSGO_BINARY only when project binary
 *   resolution succeeds. The global environment is not mutated and unresolved
 *   binaries leave launcher fallback intact. Existing process-option cases
 *   cover these branches; startup remains the language-client consumer
 *   responsibility.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states absent-cwd meaning, inherited-environment copying,
 *   conditional toolchain override and preservation of launcher fallback.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 *
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
