import fs from "node:fs";
import path from "node:path";

import type { ITtscCompilerTransformation } from "../../../structures/ITtscCompilerTransformation";
import { readJsoncFile } from "../project/readJsoncFile";
import type { RuntimeInputContents } from "./RuntimeInputContents";
import { RuntimeInputProof } from "./RuntimeInputProof";

/**
 * Turn what the upstream compiler says about one project into the filesystem
 * questions a later run must see answered the same way before reusing that
 * project's emit.
 *
 * A project without native plugins is compiled by the user's installed `tsc`,
 * which keeps no record of its reads. It does report them on request: with
 * `--listFilesOnly` it names every file of the Program, and with
 * `--traceResolution` every resolution candidate it found or did not find,
 * every directory it skipped as missing, every `package.json` it found and
 * every physical path it resolved. Recording those answers once, when the
 * project is built, lets every later run prove the project by metadata alone,
 * without starting the compiler (samchon/ttsc#1852). The compiler's own words
 * are recorded; no resolution rule is reproduced here.
 *
 * Three questions the trace does not print are answered from the project's own
 * declarations, each conservatively:
 *
 * - Root membership: the compiler expands `include` by listing directories. The
 *   listing of every directory below each include base is recorded, so any
 *   entry added or removed there is a changed answer. Descent skips what the
 *   compiler's wildcards never enter: names starting with a dot, and the
 *   implicitly excluded package directories when no config of the chain
 *   declares `exclude`.
 * - Module format: the nearest `package.json` of every file decides it, so each
 *   ancestor `package.json`, present or absent, is recorded.
 * - Automatic type inclusion: when no config of the chain declares `types`, the
 *   compiler lists every ancestor `node_modules/@types`, so those listings, or
 *   their absence, are recorded.
 *
 * @evidence contracts/common.md#principled-implementation The population is the compiler's own reported membership and resolution answers, plus listings that over-approximate its unreported directory reads; an over-approximated answer can only cost reuse, never admit a changed input.
 * @evidence contracts/common.md#clear-and-simple-design One function turns one query's output into the observation shape the native producer reports, so both lanes are replayed by the same proof.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No module resolution, glob matching or option evaluation is reimplemented: candidates come from the trace, and directory listings are recorded whole rather than filtered by a guessed pattern.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state what the compiler reports, what it does not, how each gap is covered, and why recording replaces the per-run query.
 * @evidence contracts/portability.md#os-neutral-implementation Reported paths are resolved to native spellings with path.resolve; directory kinds follow links as the compiler's enumeration does, and names are compared as returned.
 * @evidence contracts/performance.md#efficient-algorithms One pass over the query output; one listing per directory below the include bases; one content witness per read file through the shared session, which reuses rows of unchanged files.
 * @evidence contracts/performance.md#reuse-equivalent-work The returned population is stored with the emit and replayed by every later run in place of a compiler query.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The population grows with the Program's files, probes and include directories and transfers to the caller; no handle is retained.
 */
export namespace CompilerTraceObservations {
  /**
   * The observations of one project, keyed by absolute native path, or
   * undefined when the output does not have the expected shape.
   *
   * @param props.output Combined output of one `tsc -p <config> --listFilesOnly
   *   --traceResolution` run with the build's own arguments.
   * @param props.configPaths The project's config chain, base configs first.
   * @param props.configInputs Further files the config chain read.
   * @param props.contents The content session hashing files as compiler text.
   * @evidence contracts/common.md#principled-implementation Every recorded predicate is one the compiler answered or a whole listing of a directory it could have read; files the Program read carry their compiler-text hash and physical path.
   * @evidence contracts/common.md#clear-and-simple-design Parsing, listing and hashing are local steps of one projection whose result the replay consumes unchanged.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An empty file list, an unreadable listed file or an unrecognized output shape returns undefined, so the caller keeps its slower proof instead of storing a partial one.
   * @evidence contracts/common.md#meaningful-documentation Parameters state the expected query and the role of each input.
   * @evidence contracts/portability.md#os-neutral-implementation Compiler paths are converted with path.resolve; listings use native readdir and following stat.
   * @evidence contracts/performance.md#efficient-algorithms Linear in output lines, include directories and read files.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The projection itself shares nothing; its result is what later runs reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Call-local maps; the returned record transfers to the caller.
   */
  export function observe(props: {
    output: string;
    configPaths: readonly string[];
    configInputs: readonly string[];
    contents: RuntimeInputContents.Session;
  }):
    | Record<string, ITtscCompilerTransformation.IInputObservation>
    | undefined {
    const observations: Record<
      string,
      ITtscCompilerTransformation.IInputObservation
    > = Object.create(null);
    const at = (file: string): ITtscCompilerTransformation.IInputObservation =>
      (observations[path.resolve(file)] ??= {});
    const listed: string[] = [];
    for (const raw of props.output.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.length === 0) continue;
      let match: RegExpExecArray | null;
      if (
        (match =
          /^File '(.+)' exists(?: - use it as a name resolution result| according to earlier cached lookups)\.$/.exec(
            line,
          ))
      )
        at(match[1]!).fileExists = true;
      else if (
        (match =
          /^File '(.+)' does not exist(?: according to earlier cached lookups)?\.$/.exec(
            line,
          ))
      )
        at(match[1]!).fileExists = false;
      else if (
        (match =
          /^Directory '(.+)' does not exist, skipping all lookups in it\.$/.exec(
            line,
          ))
      )
        at(match[1]!).directoryExists = false;
      else if ((match = /^Found 'package\.json' at '(.+)'\.$/.exec(line)))
        at(match[1]!).fileExists = true;
      else if (
        (match = /^Resolving real path for '(.+)', result '(.+)'\.$/.exec(line))
      )
        at(match[1]!).realpath = { ok: true, path: path.resolve(match[2]!) };
      else if (path.isAbsolute(line) && /\.(?:[cm]?[jt]sx?|json)$/i.test(line))
        listed.push(path.resolve(line));
    }
    if (listed.length === 0) return undefined;

    // The files the Program read, the config chain and every package.json the
    // compiler found carry their content and physical path.
    const read = [
      ...new Set([
        ...listed,
        ...props.configPaths.map((file) => path.resolve(file)),
        ...props.configInputs.map((file) => path.resolve(file)),
        ...Object.keys(observations).filter(
          (file) =>
            path.basename(file) === "package.json" &&
            observations[file]!.fileExists === true,
        ),
      ]),
    ];
    // Module format comes from the nearest package.json of each file.
    const scopes = new Set<string>();
    for (const file of listed)
      for (let directory = path.dirname(file); !scopes.has(directory); ) {
        scopes.add(directory);
        const manifest = path.join(directory, "package.json");
        if (!read.includes(manifest)) read.push(manifest);
        const parent = path.dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
    for (const [file, physical, hash] of props.contents.observe(read)) {
      if (hash === null) {
        // Only a listed file must exist; a scope candidate may be absent.
        if (listed.includes(file)) return undefined;
        at(file).fileExists = false;
        continue;
      }
      const observation = at(file);
      // The compiler found it missing, and now it is there: it moved during
      // the query, so no population of this instant can be recorded.
      if (observation.fileExists === false) return undefined;
      observation.readFile = { ok: true, hash };
      observation.realpath = { ok: true, path: physical! };
      delete observation.fileExists;
    }

    // Root membership and automatic type inclusion are directory listings.
    const declared = props.configPaths
      .map((config) => {
        try {
          return readJsoncFile(config) as {
            include?: unknown;
            exclude?: unknown;
            files?: unknown;
            compilerOptions?: { types?: unknown; typeRoots?: unknown };
          };
        } catch {
          return {};
        }
      })
      .reverse();
    const configIndex = declared.findIndex(
      (config) => config.include !== undefined || config.files !== undefined,
    );
    const owner =
      configIndex === -1
        ? path.resolve(props.configPaths.at(-1)!)
        : path.resolve([...props.configPaths].reverse()[configIndex]!);
    const include =
      configIndex === -1
        ? ["**/*"]
        : Array.isArray(declared[configIndex]!.include)
          ? (declared[configIndex]!.include as unknown[]).filter(
              (entry): entry is string => typeof entry === "string",
            )
          : declared[configIndex]!.files === undefined
            ? ["**/*"]
            : [];
    const excluding = declared.some((config) => config.exclude !== undefined);
    for (const pattern of include) {
      const segments = pattern.split(/[\\/]/);
      const wildcard = segments.findIndex((segment) => /[*?]/.test(segment));
      const base = path.resolve(
        path.dirname(owner),
        ...(wildcard === -1 ? segments : segments.slice(0, wildcard)),
      );
      list(base, wildcard !== -1, excluding, at);
    }
    if (
      !declared.some(
        (config) =>
          config.compilerOptions?.types !== undefined ||
          config.compilerOptions?.typeRoots !== undefined,
      )
    )
      for (let directory = path.dirname(owner); ; ) {
        const types = path.join(directory, "node_modules", "@types");
        if (fs.existsSync(types)) list(types, false, true, at);
        else at(types).directoryExists = false;
        const parent = path.dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
    return observations;
  }

  /**
   * Record the listing of `root`, and of every directory below it that a
   * wildcard could enter when `recursive`.
   */
  function list(
    root: string,
    recursive: boolean,
    excluding: boolean,
    at: (file: string) => ITtscCompilerTransformation.IInputObservation,
  ): void {
    const pending = [root];
    while (pending.length !== 0) {
      const directory = pending.pop()!;
      const entries = RuntimeInputProof.listEntries(directory);
      if (entries === undefined) {
        at(directory).directoryExists = false;
        continue;
      }
      at(directory).accessibleEntries = entries;
      if (!recursive) continue;
      for (const name of entries.directories)
        if (
          !name.startsWith(".") &&
          (excluding ||
            !["node_modules", "bower_components", "jspm_packages"].includes(
              name,
            ))
        )
          pending.push(path.join(directory, name));
    }
  }
}
