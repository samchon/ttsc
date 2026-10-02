import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  type FilesystemPathIdentityContext,
  type FilesystemPathIdentityOperations,
  createFilesystemPathIdentityContext,
} from "ttsc/path-identity";

import type { ResolutionCandidate } from "./ResolutionCandidate";
import type { ResolutionCandidateInput } from "./ResolutionCandidateInput";
import type { ServerProcessOptions } from "./ServerProcessOptions";
import type { ServerLaunchCommand } from "./ServerLaunchCommand";
import type { ServerExecutable } from "./ServerExecutable";
import type { RelativePatternConstructor } from "./RelativePatternConstructor";
import {
  filterCandidatesByPhysicalRoots,
  planRootsByPhysicalIdentity,
} from "./clientRootPlanning.ts";

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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It only constructs the context; resolution cost belongs to the
  *   path-identity API.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   Memoization lives in the context it returns; this wrapper adds no cache.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   The caller owns the returned context and its lifetime; this wrapper
  *   retains nothing.
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

const PROJECT_CONFIG_PATTERN = /^(?:tsconfig|jsconfig)(?:\..*)?\.json$/;
// The extension registers these two command ids itself, so the server must not
// advertise them again; every other server command id gets the root prefix.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It does a fixed number of module resolutions and file reads.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It keeps no cache, so each call observes the current installation.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   Its synchronous reads release their handles before returning.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It projects one findProjectConfig result and owns no computation.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It delegates all sharing decisions to findProjectConfig.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing.
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
  *
  * @evidence contracts/performance.md#efficient-algorithms
  *   The walk visits at most D ancestor directories; each costs one readdir of
  *   E entries, filtered and sorted in O(E log E), plus stat calls only for
  *   matching names.
  *
  * @evidence contracts/performance.md#reuse-equivalent-work
  *   One identity context serves the whole walk, so boundary and directory
  *   identities are resolved once; nothing is cached across calls, so later
  *   disk changes are seen.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing after the synchronous walk.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It performs one config walk per active file and per workspace root, with
  *   nothing else to optimize.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   Each call rediscovers projects from disk by design, so a stale answer is
  *   never reused.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains only the returned candidate array.
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
 * JavaScript uses process.execPath. Inside the VS Code extension host that is
 * the editor binary, which runs a script as Node only while the environment it
 * inherits carries ELECTRON_RUN_AS_NODE; serverProcessOptions copies the
 * extension host environment unchanged and this module never sets the
 * variable. Windows .cmd/.bat uses an explicitly quoted cmd payload and private
 * argument environment. Other executables retain ordinary argument vectors.
 * The operation prepares data without spawning.
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
 *   JSDoc explains JS/native/Windows-shim command preparation, the
 *   process.execPath assumption, stdio arguments, quoting ownership and that
 *   preparation does not spawn.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It builds a short fixed argument vector.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It computes a cheap value and caches nothing.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing; the caller owns the returned command.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It composes two cheap results.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It caches nothing, so process options observe the current toolchain on
  *   each call.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing; the caller owns the returned executable.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It makes one constructor call.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It computes a cheap value and caches nothing.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing; the caller owns the pattern.
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
 *   Node sha256 hashes the shared rootKey identity, so aliases of one root
 *   share a namespace and distinct roots differ. The fixed ttsc.vscode. text
 *   and the trailing dot are concatenated around the digest, not hashed.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It hashes one short key once.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It is recomputed where used and keeps no cache.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing.
 */
export function executeCommandIDPrefix(root: string): string {
  const key = createHash("sha256")
    .update(rootKey(root))
    .digest("hex")
    .slice(0, 16);
  return `ttsc.vscode.${key}.`;
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   The cost belongs to filterCandidatesByPhysicalRoots.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It creates one identity context per call and passes it down; nothing is
  *   shared across calls.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   The context it creates is released when the call returns.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   The cost belongs to planRootsByPhysicalIdentity.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It creates or accepts one identity context per call; nothing is shared
  *   across calls.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing; the caller owns the plan.
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
 *   The shared identity context owns containment. Among containing roots,
 *   a descendant's resolved key extends its ancestor's key, so comparing
 *   key lengths selects the deepest root.
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
  *
  * @evidence contracts/performance.md#efficient-algorithms
  *   One scan over n roots does one containment check and at most one
  *   key-length comparison each, O(n) checks.
  *
  * @evidence contracts/performance.md#reuse-equivalent-work
  *   The default identity context is created once per call and shared by every
  *   containment check and key comparison in the scan; no result is cached
  *   across calls.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing after returning one root.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It performs one delegated containment check.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It uses the supplied context, which owns any memoization.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It performs at most two delegated containment checks.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It uses the supplied context, which owns any memoization.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing.
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
  *
  * @evidence contracts/performance.md#efficient-algorithms
  *   One filter pass over n client roots does one overlap check each, O(n)
  *   checks.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It uses one context per call and caches nothing across calls.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing; the caller owns the returned roots.
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
  *
  * @evidence contracts/performance.md#efficient-algorithms
  *   It builds a Set of the p planned keys and does one key lookup per existing
  *   root, O(n + p) keys.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It uses one context per call and caches nothing across calls.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   The Set is local and released on return.
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
  *
  * @evidence contracts/performance.md#efficient-algorithms
  *   One filter pass over n client roots does one containment check each, O(n)
  *   checks.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It uses one context per call and caches nothing across calls.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing; the caller owns the returned roots.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It delegates one identity resolution to the path-identity API.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It uses the supplied context, which owns any memoization.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing.
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
 * The language server needs the project-owned TypeScript-Go build, and the
 * server has no PATH fallback: it refuses to start without an absolute binary.
 * Missing packages and unreadable resolution return no override, which leaves
 * the ttsc launcher to resolve the binary itself and report a missing package.
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
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It does a fixed number of module resolutions and one existence check.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It keeps no cache, so each call observes the current installation.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   Its synchronous reads release their handles before returning.
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
 * An absent or empty cwd returns undefined. A resolved binary replaces any
 * TTSC_TSGO_BINARY inherited from the editor environment, because one inherited
 * value would pin every project of a multi-root workspace to a single
 * compiler. No resolved binary leaves inherited environment unchanged so the
 * launcher owns its normal fallback; the global environment is never assigned
 * here.
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
 *   JSDoc states absent-cwd meaning, inherited-environment copying, the
 *   per-project override of an inherited value and preservation of launcher
 *   fallback.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   It does one binary resolution and one environment copy.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   It keeps no cache, so each call observes the current toolchain.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   It retains nothing; the caller owns the returned options.
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
