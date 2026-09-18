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
 */
export namespace GoToolResolution {
  function isWindowsCommandWrapper(location: string): boolean {
    return process.platform === "win32" && /\.(?:bat|cmd)$/i.test(location);
  }

  /** Pin Windows PATH and command-wrapper lookup to one build-wide target. */
  export function resolveGoToolForBuild(
    binary: string,
    env: NodeJS.ProcessEnv,
    cwd: string,
  ): string {
    if (process.platform !== "win32") return binary;
    return resolveWindowsGoTool(binary, env, cwd).location ?? binary;
  }

  interface IWindowsGoToolResolution {
    location: string | null;
    wrapper: boolean;
  }

  /** Preserve libuv's native target before falling back to cmd/bat wrappers. */
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
   * The candidate paths a binary name resolves against, in search order: the path
   * itself when absolute or qualified, otherwise each `PATH` directory. On
   * Windows the current directory is searched first, as process creation does,
   * unless `NoDefaultCurrentDirectoryInExePath` is set.
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

  /** Whether `location` exists and is a regular file, following links. */
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
   * exact-case key wins; otherwise the first matching key in sorted order, so the
   * answer is deterministic when a caller supplied several spellings.
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
