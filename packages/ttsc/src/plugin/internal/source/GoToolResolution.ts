import fs from "node:fs";
import path from "node:path";

/**
 * Which `go` executable a source-plugin build runs, resolved once per build.
 *
 * On Windows, `PATH` and `PATHEXT` lookup and `.cmd`/`.bat` wrappers make a
 * bare `go` ambiguous: the answer can change between the cache-key probe and
 * the build if the environment is read twice. Resolving it once, the way the
 * platform would, and pinning that one target keeps the key and the build
 * talking about the same toolchain.
 *
 * POSIX PATH entries and qualified relative executables are also pinned before
 * the build moves into its scratch directory.
 *
 * @evidence contracts/common.md#principled-implementation Platform-specific executable lookup resolves one build-wide target; POSIX execute permission and Windows native/wrapper precedence determine usable candidates.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns search bases, executable probing and Windows environment spelling so key probes and actual spawns use one policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Candidate selection follows native process rules rather than hardcoding a particular user's Go installation or mutating process.env.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain pinned tool identity, Windows wrapper precedence, search order and environment-case handling.
 * @evidence contracts/portability.md#os-neutral-implementation Native Node paths separate POSIX permission checks from Windows PATHEXT/cmd wrapper handling; path identity is not inferred from filesystem case assumptions.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups operations; its callable members own search algorithms.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This namespace retains no computed resolution; resolveGoToolForBuild defines the build-wide sharing boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no mutable cache or native resource.
 */
export namespace GoToolResolution {
  function isWindowsCommandWrapper(location: string): boolean {
    return process.platform === "win32" && /\.(?:bat|cmd)$/i.test(location);
  }

  /**
   * Pin native PATH and command-wrapper lookup to one build-wide target.
   *
   * @evidence contracts/common.md#principled-implementation Native search bases resolve against the module directory and POSIX X_OK rejects unusable PATH entries, preventing later scratch cwd from selecting another compiler.
   * @evidence contracts/common.md#clear-and-simple-design The build-facing resolver delegates Windows wrapper policy and otherwise performs one direct native candidate search.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Pinning corrects repeated relative lookup rather than compensating for a mismatched key after the build.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies the build-wide pin and the owning namespace explains why cwd changes matter.
   * @evidence contracts/portability.md#os-neutral-implementation POSIX checks actual execute access while Windows uses its executable/wrapper rules; the returned native path is reused unchanged by build subprocesses.
   * @evidence contracts/performance.md#efficient-algorithms At most P candidate bases are probed, with constant-sized native executable choices or bounded PATHEXT candidates on Windows.
   * @evidence contracts/performance.md#reuse-equivalent-work The resolved target is shared by environment queries and the actual Go build so equivalent phases do not reinterpret relative lookup.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The resolver owns no retained memo or process; the caller keeps the resolved path for its build.
   */
  export function resolveGoToolForBuild(
    binary: string,
    env: NodeJS.ProcessEnv,
    cwd: string,
  ): string {
    if (process.platform !== "win32") {
      for (const candidate of executableSearchBases(binary, env, cwd)) {
        if (!isExecutableFile(candidate)) continue;
        try {
          fs.accessSync(candidate, fs.constants.X_OK);
          return candidate;
        } catch {
          // A non-executable PATH entry must not shadow a later usable tool.
        }
      }
      return path.isAbsolute(binary) || !hasPathQualifier(binary)
        ? binary
        : path.resolve(cwd, binary);
    }
    return resolveWindowsGoTool(binary, env, cwd).location ?? binary;
  }

  interface IWindowsGoToolResolution {
    location: string | null;
    wrapper: boolean;
  }

  /**
   * Preserve libuv's native target before falling back to cmd/bat wrappers.
   *
   * @evidence contracts/common.md#principled-implementation Direct native executable candidates take precedence and cmd/bat fallback uses PATHEXT only after that search; explicit wrapper names retain wrapper identity even when missing.
   * @evidence contracts/common.md#clear-and-simple-design One result pairs location with wrapper routing so spawn code does not repeat extension policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing wrappers are represented honestly instead of silently selecting another tool to evade spawn failure.
   * @evidence contracts/common.md#meaningful-documentation The native comment states native-before-wrapper precedence and the result fields name routing facts.
   * @evidence contracts/portability.md#os-neutral-implementation This isolates Windows native .com/.exe probing from shell-based .cmd/.bat execution and honors configured wrapper extensions.
   * @evidence contracts/performance.md#efficient-algorithms Candidate bases are built once and searched in two linear passes, costing O(P times E) filesystem probes for PATH entries and extensions.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The owning build resolver pins this result; this Windows search does not retain completed results itself.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No process or persistent handle is acquired during candidate probing.
   */
  export function resolveWindowsGoTool(
    binary: string,
    env: NodeJS.ProcessEnv,
    cwd: string,
  ): IWindowsGoToolResolution {
    const candidates = executableSearchBases(binary, env, cwd);
    if (isWindowsCommandWrapper(binary)) {
      return {
        location: candidates.find(isExecutableFile) ?? null,
        wrapper: true,
      };
    }

    const hasExtension = windowsFileNameHasExtension(binary);
    for (const candidate of candidates) {
      if (hasExtension && isExecutableFile(candidate)) {
        return { location: candidate, wrapper: false };
      }
      for (const extension of [".com", ".exe"]) {
        const executable = candidate + extension;
        if (isExecutableFile(executable)) {
          return { location: executable, wrapper: false };
        }
      }
    }

    const wrapperExtensions = windowsExecutableExtensions(env).filter((ext) =>
      /\.(?:bat|cmd)$/i.test(ext),
    );
    for (const candidate of candidates) {
      for (const extension of wrapperExtensions) {
        const executable = candidate + extension;
        if (isExecutableFile(executable)) {
          return { location: executable, wrapper: true };
        }
      }
    }
    return { location: null, wrapper: false };
  }

  /**
   * The candidate paths a binary name resolves against, in search order: the
   * path itself when absolute or qualified, otherwise each `PATH` directory. On
   * Windows the current directory is searched first, as process creation does,
   * unless `NoDefaultCurrentDirectoryInExePath` is set.
   *
   * @evidence contracts/common.md#principled-implementation Absolute and qualified paths bypass PATH search, while bare names use native ordered bases; Windows quoted entries and the parent-process cwd-search switch preserve libuv lookup distinctions.
   * @evidence contracts/common.md#clear-and-simple-design Base construction is independent of executable-extension probing, allowing Go and external-command identity readers to share it.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Search fallback uses the native POSIX default or Windows inherited PATH semantics, not a privileged compiler directory.
   * @evidence contracts/common.md#meaningful-documentation The prose states absolute/qualified handling, current-directory precedence and the disabling switch.
   * @evidence contracts/portability.md#os-neutral-implementation Node's delimiter and native paths govern POSIX search; Windows semicolon quoting and case-insensitive PATH retrieval are explicit boundaries.
   * @evidence contracts/performance.md#efficient-algorithms One pass splits PATH and one maps P bases to candidate strings; temporary space is proportional to the search list's length.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This constructs bases from current arguments and owns no cross-request search cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned candidate array survives; no native resource is retained.
   */
  export function executableSearchBases(
    binary: string,
    env: NodeJS.ProcessEnv,
    cwd: string,
  ): string[] {
    if (path.isAbsolute(binary)) return [binary];
    if (hasPathQualifier(binary)) return [path.resolve(cwd, binary)];

    const directories =
      process.platform === "win32"
        ? splitWindowsSearchPath(readPathEnvironment(env))
            // libuv skips only genuinely empty slices. A quoted-empty slice
            // survives that check, unquotes to "", and therefore names cwd.
            .filter((entry) => entry.length > 0)
            .map(unquoteWindowsSearchEntry)
        : readPathEnvironment(env).split(path.delimiter);
    const noDefaultCurrentDirectory =
      process.platform === "win32"
        ? readWindowsEnvironmentValue(
            process.env,
            "NoDefaultCurrentDirectoryInExePath",
          )
        : undefined;
    if (
      process.platform === "win32" &&
      noDefaultCurrentDirectory === undefined
    ) {
      directories.unshift(cwd);
    }
    return directories.map((dir) => path.resolve(cwd, dir, binary));
  }

  /**
   * Whether `location` exists and is a regular file, following links.
   *
   * This is a file-kind probe; POSIX executable permission is checked by the
   * build-facing resolver separately.
   *
   * @evidence contracts/common.md#principled-implementation stat's regular-file classification rejects directories and missing candidates without claiming execute access from file existence alone.
   * @evidence contracts/common.md#clear-and-simple-design One kind probe is shared by native and wrapper candidate searches; permission policy stays with the resolver that needs it.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Candidate failures return false rather than introducing a known-tool exception that bypasses the filesystem.
   * @evidence contracts/common.md#meaningful-documentation The native paragraphs explicitly distinguish file kind from POSIX execute permission.
   * @evidence contracts/portability.md#os-neutral-implementation Node's native stat follows filesystem aliases; callers separately select OS-specific execution rules rather than guessing them from a filename.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms One stat and one kind check have no population-dependent traversal algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Fresh file state is probed rather than cached beyond its observation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous stat creates no lasting handle or retained state.
   */
  export function isExecutableFile(location: string): boolean {
    try {
      return fs.statSync(location).isFile();
    } catch {
      return false;
    }
  }

  function hasPathQualifier(location: string): boolean {
    return (
      location.includes(path.sep) ||
      (process.platform === "win32" &&
        (location.includes("/") || /^[a-zA-Z]:/.test(location)))
    );
  }

  function windowsFileNameHasExtension(location: string): boolean {
    const name = path.basename(location);
    const dot = name.indexOf(".");
    return dot >= 0 && dot < name.length - 1;
  }

  function splitWindowsSearchPath(value: string): string[] {
    const entries: string[] = [];
    let start = 0;
    let quote = "";
    for (let index = 0; index < value.length; index++) {
      const character = value[index]!;
      if (quote !== "") {
        if (character === quote) quote = "";
      } else if ((character === '"' || character === "'") && index === start) {
        quote = character;
      } else if (character === ";") {
        entries.push(value.slice(start, index));
        start = index + 1;
      }
    }
    entries.push(value.slice(start));
    return entries;
  }

  function unquoteWindowsSearchEntry(location: string): string {
    const first = location[0];
    const withoutFirst =
      first === '"' || first === "'" ? location.slice(1) : location;
    const last = withoutFirst[withoutFirst.length - 1];
    return last === '"' || last === "'"
      ? withoutFirst.slice(0, -1)
      : withoutFirst;
  }

  /**
   * The executable extensions Windows tries, lower-cased and unquoted, from
   * `PATHEXT` or its documented default.
   *
   * @evidence contracts/common.md#principled-implementation Configured or default PATHEXT values are split with Windows quoting rules, normalized and stripped of empty entries before wrapper lookup.
   * @evidence contracts/common.md#clear-and-simple-design One extension reader shares the same Windows environment and search-entry helpers as PATH lookup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The default extension list is Windows invocation vocabulary, not a test-specific compiler suffix list.
   * @evidence contracts/common.md#meaningful-documentation Native prose states lowercase/unquoted output and configured-versus-default precedence.
   * @evidence contracts/portability.md#os-neutral-implementation PATHEXT handling is isolated to the Windows lookup boundary rather than applied to POSIX filenames.
   * @evidence contracts/performance.md#efficient-algorithms The configured extension text is traversed in linear passes and retains only its normalized nonempty entries.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This reads current environment arguments; the owning resolver keeps any chosen executable.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned extension list has no external lifetime or handle ownership.
   */
  export function windowsExecutableExtensions(
    env: NodeJS.ProcessEnv = process.env,
  ): readonly string[] {
    const pathext = readWindowsEnvironmentValue(env, "PATHEXT");
    const raw = pathext && pathext.length > 0 ? pathext : ".COM;.EXE;.BAT;.CMD";
    return splitWindowsSearchPath(raw)
      .map(unquoteWindowsSearchEntry)
      .map((ext) => ext.toLowerCase())
      .filter((ext) => ext.length > 0);
  }

  function readPathEnvironment(env: NodeJS.ProcessEnv = process.env): string {
    return process.platform === "win32"
      ? (readWindowsEnvironmentValue(env, "PATH") ??
          readWindowsEnvironmentValue(process.env, "PATH") ??
          "")
      : (env.PATH ?? "/usr/bin:/bin");
  }

  /**
   * Read an environment variable the way Windows does, case-insensitively. An
   * exact-case key wins; otherwise the first matching key in sorted order, so
   * the answer is deterministic when a caller supplied several spellings.
   *
   * @evidence contracts/common.md#principled-implementation Exact spelling is preferred; otherwise matching keys are sorted before selecting one, making case-insensitive aliases deterministic for injected environments.
   * @evidence contracts/common.md#clear-and-simple-design One helper centralizes the Windows variable-spelling policy used by PATH, PATHEXT and shell selection.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The helper reads the supplied environment and does not patch process.env or rename keys to accommodate a consumer.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph records exact-key precedence and sorted fallback when several aliases exist.
   * @evidence contracts/portability.md#os-neutral-implementation Case-insensitive environment names are a Windows process convention, distinct from filesystem path case policy.
   * @evidence contracts/performance.md#efficient-algorithms Exact lookup is constant-time; fallback scans N keys and sorts K matches, costing O(N plus K log K) rather than sorting unrelated environment keys.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The lookup uses the supplied current environment and retains no normalized map across calls.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No retained state or native handle is owned.
   */
  export function readWindowsEnvironmentValue(
    env: NodeJS.ProcessEnv,
    name: string,
  ): string | undefined {
    const exact = env[name];
    if (exact !== undefined) return exact;
    const normalized = name.toLowerCase();
    const key = Object.keys(env)
      .filter((candidate) => candidate.toLowerCase() === normalized)
      .sort()[0];
    return key === undefined ? undefined : env[key];
  }
}
