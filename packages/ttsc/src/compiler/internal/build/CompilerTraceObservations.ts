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
 * `--listFiles` it names every file of the Program, and with
 * `--traceResolution` every resolution candidate it found or did not find,
 * every directory it skipped as missing, every `package.json` it found and
 * every physical path it resolved. Recording those answers from the emitting
 * run itself lets every later run prove the project by metadata alone, without
 * starting the compiler (samchon/ttsc#1852), and costs no second compiler run
 * (samchon/ttsc#1859). The compiler's own words are recorded; no resolution
 * rule is reproduced here.
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
   * @param props.output Standard output of the emitting `tsc -p <config>
   *   --listFiles --traceResolution` run with the build's own arguments.
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
    const steps = observeSteps(props);
    for (;;) {
      const next = steps.next();
      if (next.done === true) return next.value;
    }
  }

  /**
   * {@link observe} in bounded steps: it yields after every batch of 256
   * witnessed files, so a launcher that records a build while its program runs
   * can stop between batches when the program ends (samchon/ttsc#1859).
   *
   * @evidence contracts/common.md#principled-implementation The same projection as observe; batching changes when the work happens, not what is recorded.
   * @evidence contracts/common.md#clear-and-simple-design observe drains this generator, so one body serves both.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A step never records a partial population; the result exists only at the end.
   * @evidence contracts/common.md#meaningful-documentation The prose states the batch size and why it exists.
   * @evidence contracts/portability.md#os-neutral-implementation As observe.
   * @evidence contracts/performance.md#efficient-algorithms As observe, with one yield per batch.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work As observe.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The generator holds the parsed population until it completes or is dropped.
   */
  export function* observeSteps(props: {
    output: string;
    configPaths: readonly string[];
    configInputs: readonly string[];
    contents: RuntimeInputContents.Session;
  }): Generator<
    void,
    Record<string, ITtscCompilerTransformation.IInputObservation> | undefined
  > {
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
    const read = new Set([
      ...listed,
      ...props.configPaths.map((file) => path.resolve(file)),
      ...props.configInputs.map((file) => path.resolve(file)),
      ...Object.keys(observations).filter(
        (file) =>
          path.basename(file) === "package.json" &&
          observations[file]!.fileExists === true,
      ),
    ]);
    // Module format comes from the nearest package.json of each file.
    const scopes = new Set<string>();
    for (const file of listed)
      for (let directory = path.dirname(file); !scopes.has(directory); ) {
        scopes.add(directory);
        read.add(path.join(directory, "package.json"));
        const parent = path.dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
    const members = new Set(listed);
    const population = [...read];
    for (let start = 0; start < population.length; start += 256) {
      yield;
      for (const [file, physical, hash] of props.contents.observe(
        population.slice(start, start + 256),
      )) {
        if (hash === null) {
          // Only a listed file must exist; a scope candidate may be absent.
          if (members.has(file)) return undefined;
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
   * `output` without the lines `--traceResolution` added to it.
   *
   * The runtime asks the emitting run for its trace instead of starting the
   * compiler a second time (samchon/ttsc#1859), so the trace must leave the
   * build's report again: a failed check shows its diagnostics, not thousands
   * of resolution steps. A line is a trace line when it is one of the module
   * and type-reference resolution messages the upstream resolver writes to its
   * tracer (`internal/module/resolver.go`), with every argument in place. A
   * diagnostic carries a file position or an `error TS` prefix, and a listed
   * file is a bare path, so neither can match a whole message.
   *
   * @param output Standard output of a run that traced its resolution.
   * @returns The output with every trace line removed, line breaks preserved.
   * @evidence contracts/common.md#principled-implementation The vocabulary is the upstream resolver's own trace messages, matched as whole lines with their argument slots, so no diagnostic or listing line is mistaken for one.
   * @evidence contracts/common.md#clear-and-simple-design The owner of the trace's grammar also removes it, beside the parser that reads it.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown lines are kept: a message outside the vocabulary stays visible rather than being guessed away.
   * @evidence contracts/common.md#meaningful-documentation The prose states why the trace is removed, the vocabulary's source and why diagnostics cannot match.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Text processing over compiler output touches no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms One pass over the lines with one combined pattern test per line.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure projection of its argument.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned text is the caller's; the compiled pattern is module-owned.
   */
  export function withoutTrace(output: string): string {
    return output
      .split(/(?<=\n)/)
      .filter((line) => !TRACE.test(line.replace(/^﻿/, "").trim()))
      .join("");
  }

  /**
   * The resolution messages the pinned upstream resolver writes to its tracer,
   * with `{n}` marking an argument.
   */
  const TRACE_MESSAGES: readonly string[] = [
    "======== Resolving module '{0}' from '{1}'. ========",
    "======== Module name '{0}' was successfully resolved to '{1}'. ========",
    "======== Module name '{0}' was successfully resolved to '{1}' with Package ID '{2}'. ========",
    "======== Module name '{0}' was not resolved. ========",
    "======== Resolving type reference directive '{0}', containing file '{1}', root directory '{2}'. ========",
    "======== Resolving type reference directive '{0}', containing file '{1}', root directory not set. ========",
    "======== Resolving type reference directive '{0}', containing file not set, root directory '{1}'. ========",
    "======== Resolving type reference directive '{0}', containing file not set, root directory not set. ========",
    "======== Resolving type reference directive '{0}', containing file '{1}'. ========",
    "======== Type reference directive '{0}' was successfully resolved to '{1}', primary: {2}. ========",
    "======== Type reference directive '{0}' was successfully resolved to '{1}' with Package ID '{2}', primary: {3}. ========",
    "======== Type reference directive '{0}' was not resolved. ========",
    "Checking if '{0}' is the longest matching prefix for '{1}' - '{2}'.",
    "Directory '{0}' does not exist, skipping all lookups in it.",
    "Directory '{0}' has no containing package.json scope. Imports will not resolve.",
    "Entering conditional exports.",
    "Exiting conditional exports.",
    "Expected type of '{0}' field in 'package.json' to be '{1}', got '{2}'.",
    "Explicitly specified module resolution kind: '{0}'.",
    "Export specifier '{0}' does not exist in package.json scope at path '{1}'.",
    "Failed to find peerDependency '{0}'.",
    "Failed to resolve under condition '{0}'.",
    "File '{0}' does not exist.",
    "File '{0}' does not exist according to earlier cached lookups.",
    "File '{0}' exists according to earlier cached lookups.",
    "File '{0}' exists - use it as a name resolution result.",
    "File name '{0}' has a '{1}' extension - stripping it.",
    "Found 'package.json' at '{0}'.",
    "Found peerDependency '{0}' with '{1}' version.",
    "Import specifier '{0}' does not exist in package.json scope at path '{1}'.",
    "Invalid import specifier '{0}' has no possible resolutions.",
    "Loading '{0}' from the root dir '{1}', candidate location '{2}'.",
    "Loading module '{0}' from 'node_modules' folder, target file types: {1}.",
    "Loading module as file / folder, candidate module location '{0}', target file types: {1}.",
    "Longest matching prefix for '{0}' is '{1}'.",
    "Looking up in 'node_modules' folder, initial location '{0}'.",
    "Matched '{0}' condition '{1}'.",
    "Module name '{0}', matched pattern '{1}'.",
    "Module resolution kind is not specified, using '{0}'.",
    "Module resolution using 'rootDirs' has failed.",
    "Resolution of non-relative name failed; trying with modern Node resolution features disabled to see if npm library needs configuration update.",
    "Resolved under condition '{0}'.",
    "Resolving in {0} mode with conditions {1}.",
    "Resolving real path for '{0}', result '{1}'.",
    "Resolving type reference directive for program that specifies custom typeRoots, skipping lookup in 'node_modules' folder.",
    "Resolving with primary search path '{0}'.",
    "Root directory cannot be determined, skipping primary search paths.",
    "Saw non-matching condition '{0}'.",
    "Scoped package detected, looking in '{0}'",
    "Searching all ancestor node_modules directories for fallback extensions: {0}.",
    "Searching all ancestor node_modules directories for preferred extensions: {0}.",
    "Skipping module '{0}' that looks like an absolute URI, target file types: {1}.",
    "Trying other entries in 'rootDirs'.",
    "Trying substitution '{0}', candidate module location: '{1}'.",
    "Using '{0}' subpath '{1}' with target '{2}'.",
    "Using compiler options of project reference redirect '{0}'.",
    "'package.json' does not have a '{0}' field.",
    "'package.json' had a falsy '{0}' field.",
    "'package.json' has '{0}' field '{1}' that references '{2}'.",
    "'package.json' has a 'peerDependencies' field.",
    "'package.json' has a 'typesVersions' entry '{0}' that matches compiler version '{1}', looking for a pattern to match module name '{2}'.",
    "'package.json' has a 'typesVersions' field with version-specific path mappings.",
    "'package.json' does not have a 'typesVersions' entry that matches version '{0}'.",
    "package.json scope '{0}' explicitly maps specifier '{1}' to null.",
    "package.json scope '{0}' has invalid type for target of specifier '{1}'",
    "package.json scope '{0}' has no imports defined.",
    "'paths' option is specified, looking for a pattern to match module name '{0}'.",
    "'rootDirs' option is set, using it to resolve relative module name '{0}'.",
  ];

  const TRACE = new RegExp(
    "^(?:" +
      TRACE_MESSAGES.map((message) =>
        message
          .split(/\{\d+\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*"),
      ).join("|") +
      ")$",
  );

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
