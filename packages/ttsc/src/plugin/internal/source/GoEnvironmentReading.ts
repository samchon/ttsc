import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { GoSourceInputs } from "./GoSourceInputs";
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
   * @returns The parsed object, or `undefined` when native acquisition or JSON
   *   object decoding failed.
   * @evidence contracts/common.md#principled-implementation Actual Go supplies values and the environment-file path; pre-read metadata and bounded rediscovery preserve the earliest file witness instead of attaching a later state to an earlier read.
   * @evidence contracts/common.md#clear-and-simple-design One acquisition serves build hashing and manifest syntax qualification; callers choose keys and own interpretation and cache admission.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A remembered file name is only a discovery hint. Every call executes Go, and unresolved movement marks its witness unproven rather than lending a historical positive verdict.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why file discovery can repeat and distinguish unavailable acquisition from current authority.
   * @evidence contracts/portability.md#os-neutral-implementation Go reports its actual environment-file location; native path metadata and the existing Go process owner supply observation and execution semantics.
   * @evidence contracts/performance.md#efficient-algorithms Hashing the complete tool/environment identity and up to three native Go queries process full name/value/output bytes. Requested keys contribute argument bytes; file discovery uses metadata rather than an SDK walk.
   * @evidence contracts/performance.md#reuse-equivalent-work Only file-location discovery hints are shared: in process across equal selected-tool/environment identities, and through the record store across equal selected tools and location variables, since the reading verifies any hint against the file Go reports. Current Go values and file authority are reacquired for every call.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The module retains one file-location hint per historical tool/environment identity, without eviction, but no positive reading or native handle; persisted hints belong to the single-file collector. Command capture/retirement belongs to spawnGoTool and the caller owns the transferred witness.
   */
  export function read(
    goBinary: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    keys: readonly string[],
    witness: PluginBuildEnvironmentWitness.Record | undefined,
    identities?: PluginContentIdentities.Store,
    projectRoot?: string,
  ): Record<string, unknown> | undefined {
    const memo = crypto.createHash("sha256").update(goBinary);
    for (const [key, value] of Object.entries(env).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    )) {
      if (value !== undefined)
        memo.update(`\0${key.length}:${key}${value.length}:${value}`);
    }
    const memoKey = memo.digest("hex");
    let named = goEnvironmentFiles.get(memoKey);
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
        PluginBuildEnvironmentWitness.add(witness, named);
      const result = spawnGoTool(goBinary, args, {
        cwd,
        projectRoot,
        encoding: "utf8",
        env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        windowsHide: true,
      });
      if (result.error !== undefined || result.status !== 0) return undefined;
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
      let repeatForToolchain = false;
      if (
        witness !== undefined &&
        typeof activeRoot === "string" &&
        typeof activeVersion === "string" &&
        !provesLocalToolchain(goBinary, env, parsed)
      ) {
        if (delegated === undefined) {
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
          return parsed;
        }
      } else if (delegated !== undefined) {
        PluginBuildEnvironmentWitness.refuse(witness, goBinary);
        return parsed;
      } else if (!provesLocalToolchain(goBinary, env, parsed)) {
        PluginBuildEnvironmentWitness.requireToolchainProbe(witness);
      }
      const reported =
        typeof parsed.GOENV === "string" &&
        parsed.GOENV !== "" &&
        parsed.GOENV !== "off"
          ? parsed.GOENV
          : null;
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
        return parsed;
      }
      if (named !== undefined && named !== null) witness?.delete(named);
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
        return parsed;
      }
    }
    if (named !== undefined && named !== null)
      PluginBuildEnvironmentWitness.refuse(witness, named);
    return undefined;
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
   * @evidence contracts/portability.md#os-neutral-implementation Native path ancestry and stat identity; Go reports its own GOROOT and GOENV.
   * @evidence contracts/performance.md#efficient-algorithms A hit hashes the variables and observes the physical and possible PWD ancestry, SDK and delegated PATH evidence recorded at the miss. A miss runs Go up to three times to establish the active SDK and environment file.
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
  ): Record<string, unknown> | undefined {
    const identity = [
      1,
      goBinary,
      path.resolve(cwd),
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
      WitnessedLoadAnswers.join(witness, kept.witness);
      return kept.value;
    }
    const observed: PluginBuildEnvironmentWitness.Record = new Map();
    witnessToolchain(goBinary, cwd, env, observed);
    const values = read(
      goBinary,
      cwd,
      env,
      keys,
      observed,
      identities,
      projectRoot,
    );
    if (values === undefined) return undefined;
    if (typeof values.GOROOT === "string" && path.isAbsolute(values.GOROOT))
      PluginBuildEnvironmentWitness.add(
        observed,
        path.join(values.GOROOT, "go.env"),
      );
    WitnessedLoadAnswers.join(witness, observed);
    WitnessedLoadAnswers.write(
      identities,
      RECORDED_READING,
      identity,
      values,
      observed,
    );
    return values;
  }

  /**
   * Identify whether Go reported the SDK that launched it. Reuse of a delegated
   * choice requires an additional probe bracketed by its SDK and lookup paths.
   *
   * @evidence contracts/common.md#principled-implementation Compares the launcher SDK observed before Go started with the active root Go actually reported.
   * @evidence contracts/common.md#clear-and-simple-design Both environment answer families share this reuse boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A different, unknown or relative root does not qualify as local. Only an observed delegated selection can obtain its own reuse witness.
   * @evidence contracts/common.md#meaningful-documentation Describes current results separately from eligibility for persistent reuse.
   * @evidence contracts/portability.md#os-neutral-implementation Native absolute paths and physical identity resolve SDK links and junctions.
   * @evidence contracts/performance.md#efficient-algorithms The launcher layout lookup and comparison use a fixed number of native filesystem operations, without another process or SDK scan.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The predicate has no memo of its own.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate retains no handle or history.
   */
  export function provesLocalToolchain(
    goBinary: string,
    env: NodeJS.ProcessEnv,
    values: Record<string, unknown>,
  ): boolean {
    const active = values.GOROOT;
    const launcher =
      SidecarEnvironment.read(env, "GOTOOLCHAIN") === "local"
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
    if (path.resolve(active) === path.resolve(launcher)) return true;
    try {
      return (
        fs.realpathSync.native(active) === fs.realpathSync.native(launcher)
      );
    } catch {
      return false;
    }
  }

  /**
   * Observe the launcher and Go's toolchain selection inputs before probing. An
   * ancestor file can start selecting a toolchain when it is created, so the
   * observation includes absent go.mod and go.work files.
   *
   * @evidence contracts/common.md#principled-implementation Capture the launcher, ancestors and initial SDK defaults before Go reads them. This covers toolchain directives under GOWORK=auto and the initial root set by goBuildEnv; externally selected toolchains are governed separately by their reported root.
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
    const roots = new Set([path.resolve(cwd)]);
    if (process.platform !== "win32") {
      const pwd = SidecarEnvironment.read(env, "PWD");
      try {
        const physical = fs.realpathSync.native(cwd);
        roots.add(physical);
        if (physical !== path.resolve(cwd))
          PluginBuildEnvironmentWitness.add(witness, path.resolve(cwd));
        if (pwd && path.isAbsolute(pwd) && pwd !== physical) {
          PluginBuildEnvironmentWitness.add(witness, pwd);
          if (fs.realpathSync.native(pwd) === physical) roots.add(pwd);
        }
      } catch {
        // The actual Go invocation still owns cwd and PWD validation.
      }
    }
    for (const root of roots) witnessWorkspaceAncestors(root, witness);
  }

  /** Record the module and workspace selectors along a possible Go cwd. */
  function witnessWorkspaceAncestors(
    root: string,
    witness: PluginBuildEnvironmentWitness.Record,
  ): void {
    for (let directory = root; ; ) {
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
    for (const directory of directories) {
      const candidate = path.resolve(cwd, directory, version);
      PluginBuildEnvironmentWitness.add(witness, candidate);
      for (const extension of extensions)
        PluginBuildEnvironmentWitness.add(witness, candidate + extension);
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
  const RECORDED_READING = "go-environment-reading";

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
