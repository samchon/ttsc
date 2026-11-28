import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { RuntimeFilesystem } from "../../../launcher/internal/runtime/RuntimeFilesystem";
import { GoSourceInputs } from "./GoSourceInputs";
import { GoToolResolution } from "./GoToolResolution";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { PluginContentIdentities } from "./PluginContentIdentities";
import { PluginLoadAnswers } from "./PluginLoadAnswers";
import { WitnessedLoadAnswers } from "./WitnessedLoadAnswers";
import { goToolVariables } from "./goToolVariables";
import { spawnGoTool } from "./spawnGoTool";

/**
 * Acquire current Go values together with their environment-file evidence.
 * Build digests and syntax readers share this owner; a file-location hint is
 * never a retained positive environment verdict (#1516, #1712).
 *
 * @evidence contracts/common.md#principled-implementation The acquisition pairs actual Go output with native pre-read file evidence; callers retain their own completeness and reuse policy.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns environment-file discovery and native acquisition for build and manifest clients.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No handwritten default GOENV path or process-permanent environment success replaces native Go.
 * @evidence contracts/common.md#meaningful-documentation Prose distinguishes observation from a discovery hint and identifies both consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The read member owns native observation and execution.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The read member owns acquisition and identity costs.
 * @evidence contracts/performance.md#reuse-equivalent-work `read` shares only file-location hints and always runs Go; `recorded` shares a whole answer across processes only under its variables and witness.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The read member describes the private hint map and delegated native lifetime.
 */
export namespace GoEnvironmentReading {
  /**
   * The Go environment file each Go tool and environment was last seen to name,
   * which lets a reading witness that file before `go env` reads it.
   */
  const goEnvironmentFiles = new Map<string, string | null>();

  let recoveryObserver:
    | ((witness: PluginBuildEnvironmentWitness.Record) => void)
    | undefined;

  /**
   * Lend native Go observations to the current synchronous watch-load step.
   *
   * @evidence contracts/common.md#principled-implementation The active load can retain observations even when Go returns no settings or the later package selection fails.
   * @evidence contracts/common.md#clear-and-simple-design The native settings reader owns observation, and the load owns recovery publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Restores the prior observer before a generator may suspend, so unrelated requests cannot borrow its watch inputs.
   * @evidence contracts/common.md#meaningful-documentation Describes the synchronous ownership boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The scope itself performs no native operation.
   * @evidence contracts/performance.md#efficient-algorithms Installs and restores one callback for the duration of one step.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The scope grants no reuse authority.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Callback ownership is restored in finally. The load owns any transferred observations.
   */
  export function withRecoveryObservations<T>(
    observe:
      | ((witness: PluginBuildEnvironmentWitness.Record) => void)
      | undefined,
    step: () => T,
  ): T {
    const previous = recoveryObserver;
    recoveryObserver = observe;
    try {
      return step();
    } finally {
      recoveryObserver = previous;
    }
  }

  /**
   * Project temporary workspace observations before they reach the watcher.
   *
   * @evidence contracts/common.md#principled-implementation Forwards native observations through the caller's workspace projection while that workspace exists.
   * @evidence contracts/common.md#clear-and-simple-design The existing scoped observer owns installation and restoration.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The projection does not create recovery authority when no observer is active.
   * @evidence contracts/common.md#meaningful-documentation Identifies where projection occurs and who receives it.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The caller supplies the native projection.
   * @evidence contracts/performance.md#efficient-algorithms Installs a single callback only when an observer exists.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This scope retains no result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The existing scope restores the callback in finally.
   */
  export function withRecoveryProjection<T>(
    project: (
      witness: PluginBuildEnvironmentWitness.Record,
    ) => PluginBuildEnvironmentWitness.Record,
    step: () => T,
  ): T {
    const observe = recoveryObserver;
    return observe === undefined
      ? step()
      : withRecoveryObservations((witness) => observe(project(witness)), step);
  }

  /**
   * Transfer actual native selection inputs to an active recovery observer.
   *
   * @evidence contracts/common.md#principled-implementation Only native witness keys are retained and selectors in the command's working directory remain with its source or scratch owner.
   * @evidence contracts/common.md#clear-and-simple-design Both settings and package selection use the same projection into the active load.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Captured signatures are forwarded without substituting later native observations.
   * @evidence contracts/common.md#meaningful-documentation Identifies the transfer and its owner.
   * @evidence contracts/portability.md#os-neutral-implementation Native workspace selectors use Node path joining, and original witness keys retain byte spellings.
   * @evidence contracts/performance.md#efficient-algorithms The active observer needs one pass over supplied keys and a map of the external observations.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Transferring proof does not validate it.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The receiving load owns the transferred map.
   */
  export function reportRecovery(
    witness: PluginBuildEnvironmentWitness.Record | undefined,
    cwd: string,
  ): void {
    if (recoveryObserver === undefined || witness === undefined) return;
    const external: PluginBuildEnvironmentWitness.Record = new Map();
    for (const [key, signature] of witness) {
      const native = PluginBuildEnvironmentWitness.pathOf(key);
      if (native === undefined) continue;
      if (
        native.file === cwd ||
        native.file === path.join(cwd, "go.mod") ||
        native.file === path.join(cwd, "go.work")
      )
        continue;
      external.set(key, signature);
    }
    if (external.size !== 0) recoveryObserver(external);
  }

  const localVersions = new Map<
    string,
    {
      identity: string;
      value: string;
      witness: PluginBuildEnvironmentWitness.Record;
    }
  >();

  /**
   * Answer family that carries the same location hint across processes, so a
   * new process does not run `go env` once merely to learn it (#1722). A wrong
   * or stale hint only costs the existing rediscovery run.
   */
  const ENVIRONMENT_FILE_HINT = "go-environment-file";

  /**
   * What chooses the file's location: `GOENV`, else `os.UserConfigDir()`
   * (`%AppData%`, `$XDG_CONFIG_HOME`, `$HOME`, Plan 9's `$home`). The hint
   * across processes is keyed by these alone, because a launch rarely repeats
   * every unrelated variable, such as a per-run trace path, and a hint that
   * misses costs the rediscovery run on every launch.
   */
  const LOCATION_VARIABLES = [
    "GOENV",
    "APPDATA",
    "XDG_CONFIG_HOME",
    "HOME",
    "home",
  ] as const;

  /**
   * Whether Go's user settings location can depend on child cwd.
   *
   * @evidence contracts/common.md#principled-implementation The explicit setting takes precedence, and the host's native user-config variable can make the default relative.
   * @evidence contracts/common.md#clear-and-simple-design Package, workspace and manifest readers share the same precondition.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The test does not guess the default Go settings file.
   * @evidence contracts/common.md#meaningful-documentation Identifies the settings location's working-directory dependency.
   * @evidence contracts/portability.md#os-neutral-implementation The shared environment accessor and native path rules establish the setting and relativity.
   * @evidence contracts/performance.md#efficient-algorithms A fixed number of variable lookups and path classification require no native probe.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work No result is retained.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No resource is acquired.
   */
  export function hasRelativeFile(env: NodeJS.ProcessEnv): boolean {
    const file = SidecarEnvironment.read(env, "GOENV");
    if (file) return file !== "off" && cwdRelative(file);
    if (process.platform === "win32")
      return cwdRelative(SidecarEnvironment.read(env, "APPDATA"));
    if (process.platform === "darwin")
      return cwdRelative(SidecarEnvironment.read(env, "HOME"));
    // Go rejects a relative XDG_CONFIG_HOME. A nonempty setting suppresses
    // the HOME fallback regardless of whether the XDG value was valid.
    return (
      !SidecarEnvironment.read(env, "XDG_CONFIG_HOME") &&
      cwdRelative(SidecarEnvironment.read(env, "HOME"))
    );
  }

  function cwdRelative(file: string | undefined): boolean {
    return (
      !!file &&
      (!path.isAbsolute(file) ||
        (process.platform === "win32" && path.parse(file).root.length === 1))
    );
  }

  /**
   * Acquire a recovery-only settings path before a workspace command starts.
   *
   * @evidence contracts/common.md#principled-implementation An explicit name or the actual local Go launcher's default is resolved from the impending command's native cwd and stated before that command starts.
   * @evidence contracts/common.md#clear-and-simple-design Reuses default discovery and witness projection from the settings reader and workspace owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Discovery does not replace the command's settings or confer reusable authority.
   * @evidence contracts/common.md#meaningful-documentation Identifies when the path is acquired and where its evidence is sent.
   * @evidence contracts/portability.md#os-neutral-implementation Go supplies the default location and the shared native cwd helper resolves its spelling.
   * @evidence contracts/performance.md#efficient-algorithms Only an active recovery observer and a cwd-sensitive default can add a native subprocess before workspace preparation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Reports current native metadata only.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Owns a temporary map and delegates native capture cleanup.
   */
  export function reportWorkspaceSettings(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    projectRoot: string | undefined,
    additionalProjectRoots: readonly string[] | undefined,
    project: (
      witness: PluginBuildEnvironmentWitness.Record,
    ) => PluginBuildEnvironmentWitness.Record,
  ): void {
    if (recoveryObserver === undefined || !hasRelativeFile(env)) return;
    const file =
      SidecarEnvironment.read(env, "GOENV") ||
      discoverRecoveryFile(
        goBinary,
        cwd,
        env,
        projectRoot,
        additionalProjectRoots,
      );
    if (file === undefined) return;
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    PluginBuildEnvironmentWitness.add(
      witness,
      GoToolResolution.workingPath(cwd, file),
    );
    reportRecovery(project(witness), cwd);
  }

  /**
   * Run `go env -json` for the requested keys and `GOENV`, the file `go env -w`
   * writes, witnessing that file before the run reads it.
   *
   * The file decides the reading without being part of it, so only its metadata
   * is kept, and it must be taken before the read: metadata taken after would
   * describe an edit that landed between the two, and a reading of the old
   * content would pass as proven. Which file `go env` reads is known only from
   * its answer, so the file this Go tool and environment named last is
   * witnessed first, and a reading that names another is taken again with that
   * one witnessed. A file that keeps moving between runs leaves the reading
   * unwitnessable, so a kept reading or a build keyed on it never holds.
   *
   * The location hint also comes from the record store when one is supplied, so
   * a new process witnesses the right file on its first run instead of running
   * `go env` once only to learn the name.
   *
   * @param identities Optional record store carrying the hint across processes.
   * @param projectRoot Consumer boundary for child output and scratch.
   * @param additionalProjectRoots Other consumer roots excluded from scratch.
   * @returns Go's values and whether the launcher supplied them, or `undefined`
   *   when native acquisition or JSON decoding failed.
   * @evidence contracts/common.md#principled-implementation Actual Go supplies values and the environment-file path; pre-read metadata and bounded rediscovery preserve the earliest file witness instead of attaching a later state to an earlier read.
   * @evidence contracts/common.md#clear-and-simple-design One acquisition serves build hashing and manifest syntax qualification; callers choose keys and own interpretation and cache admission.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A remembered file name is only a discovery hint. Every call executes Go, and unresolved movement marks its witness unproven rather than lending a historical positive verdict.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why file discovery can repeat and distinguish unavailable acquisition from current authority.
   * @evidence contracts/portability.md#os-neutral-implementation Go reports its actual environment-file location; native path metadata and the existing Go process owner supply observation and execution semantics.
   * @evidence contracts/performance.md#efficient-algorithms Hashing the complete tool/environment identity and up to three JSON settings queries process full name/value/output bytes. A POSIX root containing the replacement character can add one plain byte confirmation to each settings query. A cold same-root answer can also query the launcher's local version once. File discovery uses metadata without an SDK walk.
   * @evidence contracts/performance.md#reuse-equivalent-work Each call queries current Go settings. File-location hints are shared in process and through the record store. A same-root launcher version is reused in process only for the same executable, environment and working directory while their metadata evidence holds.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The module retains one file-location hint per tool and environment and one current version proof per launcher path without eviction. The answer store collects persisted hints. Command capture belongs to spawnGoTool and the caller owns the settings witness.
   */
  export function read(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    keys: readonly string[],
    witness: PluginBuildEnvironmentWitness.Record | undefined,
    identities?: PluginContentIdentities.Store,
    projectRoot?: string,
    additionalProjectRoots?: readonly string[],
  ): { values: Record<string, unknown>; local: boolean } | undefined {
    const observed =
      witness ?? (recoveryObserver === undefined ? undefined : new Map());
    try {
      return readObserved(
        goBinary,
        cwd,
        env,
        keys,
        observed,
        identities,
        projectRoot,
        additionalProjectRoots,
      );
    } finally {
      reportRecovery(observed, cwd);
    }
  }

  /** Read settings while the caller owns the first native observations. */
  function readObserved(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    keys: readonly string[],
    witness: PluginBuildEnvironmentWitness.Record | undefined,
    identities: PluginContentIdentities.Store | undefined,
    projectRoot: string | undefined,
    additionalProjectRoots: readonly string[] | undefined,
  ): { values: Record<string, unknown>; local: boolean } | undefined {
    const configured = SidecarEnvironment.read(env, "GOENV");
    const memo = crypto.createHash("sha256").update(goBinary);
    for (const [key, value] of Object.entries(env).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    )) {
      if (value !== undefined)
        memo.update(`\0${key.length}:${key}${value.length}:${value}`);
    }
    const memoKey = memo.digest("hex");
    // Hints keep Go's spelling, never a pathname resolved under another cwd.
    let named = configured
      ? configured === "off"
        ? null
        : configured
      : goEnvironmentFiles.get(memoKey);
    if (named === undefined) {
      const hinted = PluginLoadAnswers.read(
        identities,
        ENVIRONMENT_FILE_HINT,
        hintKey(goBinary, env),
      );
      if (hinted === null || typeof hinted === "string") named = hinted;
    }
    const remembered = named;
    const args = [
      "env",
      "-json",
      ...new Set([...keys, "GOROOT", "GOVERSION", "GOENV"]),
    ];
    let delegated: readonly [root: string, version: string] | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (named !== undefined && named !== null)
        PluginBuildEnvironmentWitness.add(
          witness,
          GoToolResolution.workingPath(cwd, named),
        );
      const result = spawnGoTool(goBinary, args, {
        additionalProjectRoots,
        cwd,
        projectRoot,
        encoding: "utf8",
        env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        windowsHide: true,
      });
      if (result.error !== undefined) return undefined;
      if (result.status !== 0) {
        if (recoveryObserver === undefined || named !== undefined)
          return undefined;
        named = discoverRecoveryFile(
          goBinary,
          cwd,
          env,
          projectRoot,
          additionalProjectRoots,
        );
        if (named === undefined) return undefined;
        const file = GoToolResolution.workingPath(cwd, named);
        PluginBuildEnvironmentWitness.add(witness, file);
        continue;
      }
      let parsed: Record<string, unknown>;
      try {
        const decoded: unknown = JSON.parse(result.stdout);
        if (
          decoded === null ||
          typeof decoded !== "object" ||
          Array.isArray(decoded)
        )
          return undefined;
        parsed = decoded as Record<string, unknown>;
      } catch {
        return undefined;
      }
      const activeRoot = parsed.GOROOT;
      const activeVersion = parsed.GOVERSION;
      if (
        process.platform !== "win32" &&
        typeof activeRoot === "string" &&
        activeRoot.includes("\ufffd") &&
        !confirmsGoRootBytes(
          goBinary,
          cwd,
          env,
          activeRoot,
          witness,
          projectRoot,
          additionalProjectRoots,
        )
      ) {
        // A decoded path can point to a different, usable SDK. Its metadata
        // cannot stand in for the root used by the native process.
        delete parsed.GOROOT;
        PluginBuildEnvironmentWitness.refuse(witness, goBinary);
        return { values: parsed, local: false };
      }
      const local =
        matchesLauncherRoot(goBinary, env, parsed.GOROOT) &&
        (SidecarEnvironment.read(env, "GOTOOLCHAIN") === "local" ||
          (typeof activeVersion === "string" &&
            activeVersion ===
              readLocalVersion(
                goBinary,
                cwd,
                env,
                memoKey,
                witness,
                projectRoot,
                additionalProjectRoots,
              )));
      const reading = { values: parsed, local };
      let repeatForToolchain = false;
      if (
        witness !== undefined &&
        typeof activeRoot === "string" &&
        typeof activeVersion === "string" &&
        !local
      ) {
        if (delegated === undefined) {
          // A delegated reread can qualify a stable launcher only. Preserve
          // the first witness so its owner can reject a changed toolchain
          // without starting an extra process for this attempt.
          if (!PluginBuildEnvironmentWitness.holds(witness)) return reading;
          delegated = [activeRoot, activeVersion];
          witnessDelegatedToolchain(
            cwd,
            env,
            activeRoot,
            activeVersion,
            witness,
          );
          repeatForToolchain = true;
        } else if (
          delegated[0] !== activeRoot ||
          delegated[1] !== activeVersion
        ) {
          PluginBuildEnvironmentWitness.refuse(witness, goBinary);
          return reading;
        }
      } else if (delegated !== undefined) {
        PluginBuildEnvironmentWitness.refuse(witness, goBinary);
        return reading;
      } else if (!local) {
        PluginBuildEnvironmentWitness.requireToolchainProbe(witness);
      }
      const reported =
        typeof parsed.GOENV === "string" &&
        parsed.GOENV !== "" &&
        parsed.GOENV !== "off"
          ? parsed.GOENV
          : null;
      if (reported !== null)
        parsed.GOENV = GoToolResolution.workingPath(cwd, reported);
      else if (configured === "off") parsed.GOENV = "off";
      if (reported === named) {
        goEnvironmentFiles.set(memoKey, named);
        if (named !== remembered)
          PluginLoadAnswers.write(
            identities,
            ENVIRONMENT_FILE_HINT,
            hintKey(goBinary, env),
            named,
          );
        if (repeatForToolchain) continue;
        return reading;
      }
      if (named !== undefined && named !== null)
        witness?.delete(GoToolResolution.workingPath(cwd, named));
      named = reported;
      goEnvironmentFiles.set(memoKey, named);
      // No file to witness: the reading depends on none.
      if ((named === null || witness === undefined) && !repeatForToolchain) {
        if (named !== remembered)
          PluginLoadAnswers.write(
            identities,
            ENVIRONMENT_FILE_HINT,
            hintKey(goBinary, env),
            named,
          );
        return reading;
      }
    }
    if (named !== undefined && named !== null)
      PluginBuildEnvironmentWitness.refuse(
        witness,
        GoToolResolution.workingPath(cwd, named),
      );
    return undefined;
  }

  /** Locate the user settings with the local launcher when selection failed. */
  function discoverRecoveryFile(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    projectRoot: string | undefined,
    additionalProjectRoots: readonly string[] | undefined,
  ): string | undefined {
    const result = spawnGoTool(goBinary, ["env", "-json", "GOENV"], {
      additionalProjectRoots,
      cwd,
      projectRoot,
      encoding: "utf8",
      env: SidecarEnvironment.merge(
        GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        { GOTOOLCHAIN: "local", GOWORK: "off", GOFLAGS: " " },
      ),
      windowsHide: true,
    });
    if (result.error !== undefined || result.status !== 0) return undefined;
    try {
      const file: unknown = JSON.parse(result.stdout)?.GOENV;
      if (typeof file === "string" && file !== "" && file !== "off")
        return file;
    } catch {
      // The original selection remains unavailable.
    }
    return undefined;
  }

  /** Confirm the plain Go value before trusting an ambiguous JSON spelling. */
  function confirmsGoRootBytes(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    root: string,
    witness: PluginBuildEnvironmentWitness.Record | undefined,
    projectRoot: string | undefined,
    additionalProjectRoots: readonly string[] | undefined,
  ): boolean {
    if (witness !== undefined && !PluginBuildEnvironmentWitness.holds(witness))
      return false;
    let bytes: Buffer | undefined;
    const result = spawnGoTool(goBinary, ["env", "GOROOT"], {
      additionalProjectRoots,
      cwd,
      projectRoot,
      encoding: "utf8",
      env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
      onStdoutBytes: (stdout) => {
        bytes = stdout;
      },
      windowsHide: true,
    });
    return (
      result.error === undefined &&
      result.status === 0 &&
      bytes?.equals(Buffer.from(`${root}\n`)) === true
    );
  }

  /**
   * {@link read}, answered from the record a previous process left while
   * everything that reading depended on still holds (`WitnessedLoadAnswers`).
   *
   * A go.mod reader qualifies its parse cache by the Go tool's `GOROOT` and
   * `GOENV` once per load, so every launch ran `go env` for values nothing had
   * changed (samchon/ttsc#1852). The answer depends on the variables the tool
   * receives (`goToolVariables`) and on files no variable names, each witnessed
   * here: the tool, the file `go env -w` writes ({@link read}), the `go.mod` and
   * `go.work` that `cwd` and its ancestors hold or lack, which can switch the
   * toolchain, and the toolchain's own `go.env`, observed once Go has named its
   * GOROOT.
   *
   * @param goBinary The Go tool.
   * @param cwd Working directory of the run.
   * @param env Effective environment of the run.
   * @param keys Requested `go env` keys.
   * @param witness Receives the paths the answer depends on.
   * @param identities Optional record store; without it every call runs Go.
   * @param projectRoot Consumer boundary for child output and scratch.
   * @returns The parsed object, or `undefined` when Go could not answer.
   * @evidence contracts/common.md#principled-implementation A recorded answer is served only under every variable the tool receives and the metadata of every file that selects its toolchain or environment; Go answers whenever either moved.
   * @evidence contracts/common.md#clear-and-simple-design The shared witnessed-answer owner carries the proof; this member only names what Go reads.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No handwritten Go value or path is assumed: the values and the environment-file location still come from Go.
   * @evidence contracts/common.md#meaningful-documentation Native prose lists each witnessed dependency and why it can change the answer.
   * @evidence contracts/portability.md#os-neutral-implementation The key preserves Go's original cwd spelling and the caller's base for a relative cwd. Native directory identity qualifies the selected ancestry, and Go reports its own GOROOT and GOENV.
   * @evidence contracts/performance.md#efficient-algorithms A hit hashes the variables and observes the physical and possible PWD ancestry, SDK and delegated PATH evidence recorded at the miss. A miss runs up to three JSON settings queries, each with a plain POSIX byte confirmation if the reported root contains the replacement character. It can also add one cold launcher-version query when the root matches the launcher.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal tool, directory, keys and variables share one Go run across processes while the witness holds.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Records belong to the answer store's collector; nothing is retained in memory.
   */
  export function recorded(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    keys: readonly string[],
    witness: PluginBuildEnvironmentWitness.Record | undefined,
    identities: PluginContentIdentities.Store | undefined,
    projectRoot?: string,
    additionalProjectRoots?: readonly string[],
  ): Record<string, unknown> | undefined {
    const identity = [
      2,
      goBinary,
      cwd,
      path.isAbsolute(cwd) ? null : process.cwd(),
      keys,
      goToolVariables(env),
    ];
    const kept = WitnessedLoadAnswers.read(
      identities,
      RECORDED_READING,
      identity,
      (value): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value),
    );
    if (kept !== undefined) {
      PluginBuildEnvironmentWitness.join(witness, kept.witness);
      reportRecovery(kept.witness, cwd);
      return kept.value;
    }
    const observed: PluginBuildEnvironmentWitness.Record = new Map();
    witnessToolchain(goBinary, cwd, env, observed);
    const reading = read(
      goBinary,
      cwd,
      env,
      keys,
      observed,
      identities,
      projectRoot,
      additionalProjectRoots,
    );
    if (reading === undefined) return undefined;
    const { values } = reading;
    if (typeof values.GOROOT === "string" && path.isAbsolute(values.GOROOT))
      PluginBuildEnvironmentWitness.add(
        observed,
        path.join(values.GOROOT, "go.env"),
      );
    PluginBuildEnvironmentWitness.join(witness, observed);
    WitnessedLoadAnswers.write(
      identities,
      RECORDED_READING,
      identity,
      values,
      observed,
    );
    return values;
  }

  /** Match the reported root to the SDK layout of the launcher path. */
  function matchesLauncherRoot(
    goBinary: string,
    env: NodeJS.ProcessEnv,
    active: unknown,
  ): boolean {
    const explicitlyLocal =
      SidecarEnvironment.read(env, "GOTOOLCHAIN") === "local";
    const launcher = explicitlyLocal
      ? SidecarEnvironment.read(env, "GOROOT") ||
        GoSourceInputs.inferGoRoot(goBinary)
      : GoSourceInputs.inferGoRoot(goBinary);
    if (
      typeof active !== "string" ||
      launcher === null ||
      !path.isAbsolute(active) ||
      !path.isAbsolute(launcher)
    )
      return false;
    if (active === launcher) return true;
    try {
      return (
        RuntimeFilesystem.realpathWitness(active) ===
        RuntimeFilesystem.realpathWitness(launcher)
      );
    } catch {
      return false;
    }
  }

  /** Read the version of the executable with Go delegation disabled. */
  function readLocalVersion(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    memoKey: string,
    witness: PluginBuildEnvironmentWitness.Record | undefined,
    projectRoot: string | undefined,
    additionalProjectRoots: readonly string[] | undefined,
  ): string | undefined {
    const directory = nativeWorkingDirectory(cwd);
    const identity = JSON.stringify([memoKey, directory]);
    const kept = localVersions.get(goBinary);
    if (
      kept?.identity === identity &&
      PluginBuildEnvironmentWitness.holds(kept.witness)
    ) {
      PluginBuildEnvironmentWitness.join(witness, kept.witness);
      return kept.value;
    }
    if (witness !== undefined && !PluginBuildEnvironmentWitness.holds(witness))
      return undefined;
    const observed: PluginBuildEnvironmentWitness.Record = new Map();
    PluginBuildEnvironmentWitness.add(observed, goBinary);
    PluginBuildEnvironmentWitness.addDirectoryIdentity(observed, directory);
    const result = spawnGoTool(goBinary, ["env", "-json", "GOVERSION"], {
      additionalProjectRoots,
      cwd,
      projectRoot,
      encoding: "utf8",
      env: SidecarEnvironment.merge(
        GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        { GOTOOLCHAIN: "local", GOWORK: "off" },
      ),
      windowsHide: true,
    });
    if (result.error !== undefined || result.status !== 0) return undefined;
    try {
      const value: unknown = JSON.parse(result.stdout)?.GOVERSION;
      if (typeof value !== "string" || value === "") return undefined;
      if (!PluginBuildEnvironmentWitness.holds(observed)) return undefined;
      localVersions.set(goBinary, { identity, value, witness: observed });
      PluginBuildEnvironmentWitness.join(witness, observed);
      return value;
    } catch {
      return undefined;
    }
  }

  /**
   * Observe the launcher and Go's toolchain selection inputs before probing. An
   * ancestor file can start selecting a toolchain when it is created, so the
   * observation includes absent go.mod and go.work files.
   *
   * @evidence contracts/common.md#principled-implementation Capture the launcher, ancestors and initial SDK defaults before Go reads them. On POSIX the physical cwd and any PWD accepted by native device and inode identity supply the starting directories. On Windows Go uses the OS working-directory spelling.
   * @evidence contracts/common.md#clear-and-simple-design Both Go answer families reuse the same pre-probe observations and retain their own reported values.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native ancestor and SDK paths provide the selection evidence, including absent files. The probe still supplies all Go values.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains when to observe and why missing files matter.
   * @evidence contracts/portability.md#os-neutral-implementation Node native paths find the ancestors and Go's own distribution layout supplies go.env; environment names use SidecarEnvironment's native policy.
   * @evidence contracts/performance.md#efficient-algorithms Two witness lookups per ancestor plus a fixed set for the launcher and inferred SDK. Directory/path length and native stat costs contribute to the traversal.
   * @evidence contracts/performance.md#reuse-equivalent-work The first observation of a path stays in the caller's witness. The two answer families reuse the mechanics of capturing it, with their own freshness checks.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the caller's witness retains these observations.
   */
  export function witnessToolchain(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    witness: PluginBuildEnvironmentWitness.Record | undefined,
  ): void {
    if (witness === undefined) return;
    if (path.isAbsolute(goBinary))
      PluginBuildEnvironmentWitness.add(witness, goBinary);
    const configured = SidecarEnvironment.read(env, "GOROOT");
    const initialRoot = configured || GoSourceInputs.inferGoRoot(goBinary);
    if (initialRoot && path.isAbsolute(initialRoot))
      PluginBuildEnvironmentWitness.add(
        witness,
        path.join(initialRoot, "go.env"),
      );
    const directory = nativeWorkingDirectory(cwd);
    const roots = new Set<string>();
    if (process.platform === "win32") roots.add(path.resolve(cwd));
    try {
      const physical = RuntimeFilesystem.realpathWitness(directory);
      const current = fs.statSync(directory, { bigint: true });
      PluginBuildEnvironmentWitness.addDirectoryIdentity(
        witness,
        directory,
        current,
        physical,
      );
      if (process.platform !== "win32") {
        if (RuntimeFilesystem.rawRealpath(physical) === undefined)
          roots.add(physical);
        else PluginBuildEnvironmentWitness.requireToolchainProbe(witness);
        const pwd = SidecarEnvironment.read(env, "PWD");
        if (pwd && path.isAbsolute(pwd) && pwd !== physical) {
          PluginBuildEnvironmentWitness.addDirectoryIdentity(witness, pwd);
          const alias = fs.statSync(pwd, {
            bigint: true,
            throwIfNoEntry: false,
          });
          // os.Getwd on POSIX honors PWD when os.SameFile confirms it.
          if (alias?.dev === current.dev && alias.ino === current.ino)
            roots.add(pwd);
        }
      }
    } catch {
      // The actual Go invocation still owns cwd and PWD validation.
      PluginBuildEnvironmentWitness.addDirectoryIdentity(witness, directory);
      PluginBuildEnvironmentWitness.requireToolchainProbe(witness);
    }
    for (const root of roots) witnessWorkspaceAncestors(root, witness);
  }

  /** Keep dot-parent components until native directory lookup follows links. */
  function nativeWorkingDirectory(cwd: string): string {
    return path.isAbsolute(cwd) ? cwd : `${process.cwd()}${path.sep}${cwd}`;
  }

  /** Record the module and workspace selectors along a possible Go cwd. */
  function witnessWorkspaceAncestors(
    root: string,
    witness: PluginBuildEnvironmentWitness.Record,
  ): void {
    // Go's workspace and module searches clean the selector paths they join.
    for (let directory = path.normalize(root); ; ) {
      PluginBuildEnvironmentWitness.add(
        witness,
        path.join(directory, "go.mod"),
      );
      PluginBuildEnvironmentWitness.add(
        witness,
        path.join(directory, "go.work"),
      );
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }

  /**
   * Record the selected SDK and the ordered lookup population before reading a
   * delegated answer again. Each candidate's native presence and metadata
   * expose additions, removals and replacements at the selected version name.
   */
  function witnessDelegatedToolchain(
    cwd: string,
    env: NodeJS.ProcessEnv,
    root: string,
    version: string,
    witness: PluginBuildEnvironmentWitness.Record,
  ): void {
    PluginBuildEnvironmentWitness.add(witness, path.join(root, "go.env"));
    PluginBuildEnvironmentWitness.add(
      witness,
      path.join(root, "bin", process.platform === "win32" ? "go.exe" : "go"),
    );
    const search = SidecarEnvironment.read(env, "PATH") ?? "";
    const windows = process.platform === "win32";
    const directories = windows
      ? windowsGoSearchDirectories(search)
      : search.split(path.delimiter);
    if (
      windows &&
      SidecarEnvironment.read(env, "NoDefaultCurrentDirectoryInExePath") ===
        undefined
    )
      directories.unshift(cwd);
    const extensions = windows
      ? (SidecarEnvironment.read(env, "PATHEXT") || ".com;.exe;.bat;.cmd")
          .toLowerCase()
          .split(";")
          .filter(Boolean)
          .map((extension) =>
            extension.startsWith(".") ? extension : "." + extension,
          )
      : [];
    let searchRoot = cwd;
    if (!windows) {
      try {
        searchRoot = fs.realpathSync.native(cwd);
      } catch {
        // The actual Go invocation reports an unusable working directory.
      }
    }
    const observe = (file: string): void => {
      PluginBuildEnvironmentWitness.add(witness, file);
      // Windows compares the link entries themselves for ErrDot.
      if (windows) PluginBuildEnvironmentWitness.addLink(witness, file);
    };
    for (const directory of directories) {
      const candidate = path.resolve(searchRoot, directory, version);
      observe(candidate);
      for (const extension of extensions) observe(candidate + extension);
    }
  }

  /** Go's Windows filepath.SplitList honors and removes double quotes. */
  function windowsGoSearchDirectories(search: string): string[] {
    const directories: string[] = [];
    let directory = "";
    let quoted = false;
    for (const character of search) {
      if (character === '"') quoted = !quoted;
      else if (character === ";" && !quoted) {
        if (directory !== "") directories.push(directory);
        directory = "";
      } else directory += character;
    }
    if (directory !== "") directories.push(directory);
    return directories;
  }

  /** Answer family of {@link recorded} (`WitnessedLoadAnswers`). */
  const RECORDED_READING = "go-environment-reading-v6";

  // A wrong hint is safe: the reading compares it with the `GOENV` Go reports
  // and runs again with the reported file witnessed.
  function hintKey(goBinary: string, env: NodeJS.ProcessEnv): unknown {
    return [
      goBinary,
      LOCATION_VARIABLES.map(
        (name) => SidecarEnvironment.read(env, name) ?? null,
      ),
    ];
  }
}
