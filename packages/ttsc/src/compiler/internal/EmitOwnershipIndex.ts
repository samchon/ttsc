import fs from "node:fs";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
import type { FilesystemPathIdentityContext } from "../../internal/pathIdentity/FilesystemPathIdentityContext";
import { isOutsideRelativePath } from "./isOutsideRelativePath";

/**
 * Answers which JavaScript one finished build emitted from a given source file,
 * and answers only with proof.
 *
 * A build compiles its sources with a pinned `rootDir` into an `outDir`, so the
 * compiler writes the output of `<rootDir>/<rel>.ts` to `<outDir>/<rel>.js`.
 * That placement is the only evidence of ownership there is, and this index
 * reads it in both directions:
 *
 * 1. **Forward.** Mirror the source's physical path below the physical root into
 *    the emit directory. An output there was compiled from that very file.
 * 2. **Inverse.** When the forward path misses, map the outputs that could be
 *    the source's back through the root, and compare filesystem identities. The
 *    forward mirror misses whenever the compiler saw the file through another
 *    spelling of it: a Windows 8.3 directory in a `files` entry, a symlinked
 *    file inside the root, or a different case on a case-insensitive volume.
 *    Identity is the filesystem's own answer, so those spellings meet again,
 *    and two different files never do.
 *
 * A file the build did not compile gets `null`, never the output of some other
 * file that shares its name. Callers treat `null` as "this build does not own
 * the file" and route it to the lane that does, which is the whole point:
 * a trailing-name match once served `src/index.js` for any `index.ts` the
 * build had never seen (samchon/ttsc#1382).
 *
 * What the build emitted is its record, taken once when the build finished
 * ({@link EmitOwnershipIndex.listOutputs}) and handed to every process that
 * serves from it. Ownership is decided against that record, not against the
 * disk at lookup time, so an output that later disappears is still known to be
 * owned and its reader can fail by name instead of routing the source to a
 * lane that runs something else. Without a record the index takes one itself
 * on first use; every consumer owns a private, freshly written emit directory,
 * so that listing stays valid, and every answer is memoized.
 */
export class EmitOwnershipIndex {
  /** Directory the build wrote its JavaScript into. */
  public readonly emitDir: string;

  /**
   * The source root the build was pinned to, in any spelling of it. Only its
   * identity is used, so a short, long, or symlinked spelling all work.
   */
  public readonly rootDir: string;

  private readonly identities: FilesystemPathIdentityContext;
  private readonly answers = new Map<string, string | null>();
  private readonly answersBySpelling = new Map<string, string | null>();
  private readonly sourceKeys = new Map<string, readonly SourceCandidate[]>();
  private readonly mapped = new Map<string, string | null | undefined>();
  private recorded: ReadonlySet<string> | undefined;
  private buckets: Map<string, string[]> | undefined;
  private linked: string[] | undefined;
  private physicalRoot: string | undefined;
  private physicalEmitDir: string | undefined;

  /**
   * Index one finished build. Nothing is read until the first lookup.
   *
   * @param props.emitDir - The build's output directory.
   * @param props.rootDir - The source root the build was pinned to.
   * @param props.outputs - The build's record, as {@link listOutputs} returned
   *   it when the build finished. Omit it to have the index list the directory
   *   itself on first use.
   */
  public constructor(props: {
    emitDir: string;
    rootDir: string;
    outputs?: readonly string[];
  }) {
    this.emitDir = path.resolve(props.emitDir);
    this.rootDir = path.resolve(props.rootDir);
    this.recorded =
      props.outputs === undefined ? undefined : new Set(props.outputs);
    this.identities = createFilesystemPathIdentityContext({
      throwOnRealpathError: false,
    });
  }

  /**
   * Every JavaScript output under `emitDir`, relative to it with `/`
   * separators: the record a build takes of itself once it finishes.
   *
   * Take it as soon as the build finishes, before anything else is placed in
   * the directory. ttsx's virtual project layout later links or copies the
   * user's own files in beside the outputs, and a hard link or a copy cannot be
   * told apart from an output afterwards. Symbolic links and junctions are
   * never followed, as they reach the user's tree, not this build's output.
   */
  public static listOutputs(emitDir: string): string[] {
    const root = path.resolve(emitDir);
    const outputs: string[] = [];
    const stack = [root];
    while (stack.length !== 0) {
      const directory = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const location = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          stack.push(location);
        } else if (entry.isFile() && sourceExtensions(location).length !== 0) {
          outputs.push(path.relative(root, location).split(path.sep).join("/"));
        }
      }
    }
    return outputs.sort();
  }

  /**
   * The JavaScript this build emitted from `source`, or `null` when it emitted
   * none.
   *
   * @param source - A TypeScript (or JavaScript, under `allowJs`) source file,
   *   in any spelling that names it.
   */
  public find(source: string): string | null {
    const spelled = path.resolve(source);
    const known = this.answersBySpelling.get(spelled);
    if (known !== undefined) return known;
    // A spelling not seen before is resolved with a fresh context: a program
    // may write a source after an earlier lookup cached its directory as
    // missing.
    const identity = createFilesystemPathIdentityContext({
      throwOnRealpathError: false,
    }).resolve(spelled);
    let answer = this.answers.get(identity.key);
    if (answer === undefined) {
      answer =
        this.findForward(identity.path, identity.key) ??
        this.findInverse(identity.path, identity.key);
      this.answers.set(identity.key, answer);
    }
    this.answersBySpelling.set(spelled, answer);
    return answer;
  }

  private findForward(physical: string, key: string): string | null {
    const relative = path.relative(this.resolvedRoot(), physical);
    if (relative === "" || isOutsideRelativePath(relative)) return null;
    const stem = relative.slice(
      0,
      relative.length - path.extname(relative).length,
    );
    for (const extension of emittedExtensions(physical)) {
      const output = stem + extension;
      if (!this.recordedOutputs().has(output.split(path.sep).join("/"))) {
        continue;
      }
      const location = path.join(this.resolvedEmitDir(), output);
      return this.owns(location, key) ? location : null;
    }
    return null;
  }

  /**
   * Compare the identity of each output's source with the one asked for. Three
   * candidate sets, cheapest first, and together they cover every way one file
   * can carry two spellings: an aliased directory keeps the file's name, an 8.3
   * alias of the file itself carries a `~`, and a symbolic link to the file can
   * carry any name at all.
   */
  private findInverse(physical: string, key: string): string | null {
    const buckets = this.outputBuckets();
    return (
      this.matchOutput(buckets.get(bucketKey(physical)) ?? [], key) ??
      this.matchOutput(buckets.get(SHORT_NAME_BUCKET) ?? [], key) ??
      this.matchOutput(this.linkedOutputs(), key)
    );
  }

  private matchOutput(outputs: readonly string[], key: string): string | null {
    for (const output of outputs) {
      if (this.owns(output, key)) return output;
    }
    return null;
  }

  /**
   * Whether `output` was compiled from the source whose identity is `key`.
   *
   * The output's name admits a few sources: `a.js` comes from `a.ts` or
   * `a.tsx` (or, under `allowJs`, `a.js` or `a.jsx`). The asked source must be
   * one of those that exists. When it is the only TypeScript one, that settles
   * it.
   *
   * When `a.ts` and `a.tsx` both exist, only one of them can be in the output.
   * The build's source map names it: its `sources` entry is the file the
   * compiler read. Without a map, the compiler's own precedence decides, the
   * one it applies when it expands `include` and when it resolves `./a`: `.ts`
   * before `.tsx`, which is the order {@link sourceExtensions} lists them in.
   */
  private owns(output: string, key: string): boolean {
    const sources = this.existingSources(output);
    if (!sources.some((source) => source.key === key)) return false;
    const typescript = sources.filter((source) => source.typescript);
    if (typescript.every((source) => source.key === key)) return true;
    const mapped = this.mappedSource(output);
    if (mapped !== undefined) return mapped === key;
    return typescript[0]!.key === key;
  }

  /**
   * The identity of the source `output`'s source map names, `null` when the
   * map names none this index can resolve, or `undefined` when the output has
   * no readable map. Read only for an output two sources could have produced.
   */
  private mappedSource(output: string): string | null | undefined {
    if (this.mapped.has(output)) return this.mapped.get(output);
    let answer: string | null | undefined;
    try {
      const external = `${output}.map`;
      let text: string | undefined;
      let base = path.dirname(output);
      if (isFile(external)) {
        text = fs.readFileSync(external, "utf8");
        base = path.dirname(external);
      } else {
        const inline = fs
          .readFileSync(output, "utf8")
          .match(
            /\/\/# sourceMappingURL=data:application\/json[^,]*;base64,([A-Za-z0-9+/=]+)\s*$/,
          );
        if (inline) text = Buffer.from(inline[1]!, "base64").toString("utf8");
      }
      if (text !== undefined) {
        const map = JSON.parse(text) as {
          sourceRoot?: unknown;
          sources?: unknown;
        };
        const first = Array.isArray(map.sources) ? map.sources[0] : undefined;
        answer =
          typeof first === "string"
            ? this.identities.resolve(
                path.resolve(
                  base,
                  typeof map.sourceRoot === "string" ? map.sourceRoot : "",
                  first,
                ),
              ).key
            : null;
      }
    } catch {
      answer = undefined;
    }
    this.mapped.set(output, answer);
    return answer;
  }

  /** The sources that exist for `output`, resolved once per output. */
  private existingSources(output: string): readonly SourceCandidate[] {
    let sources = this.sourceKeys.get(output);
    if (sources === undefined) {
      sources = this.sourceCandidates(output)
        .filter(isFile)
        .map((source) => ({
          key: this.identities.resolve(source).key,
          typescript: /\.[cm]?tsx?$/i.test(source),
        }));
      this.sourceKeys.set(output, sources);
    }
    return sources;
  }

  /** Where the source of `output` sits below the root, per source extension. */
  private sourceCandidates(output: string): string[] {
    const relative = path.relative(this.resolvedEmitDir(), output);
    const stem = relative.slice(
      0,
      relative.length - path.extname(relative).length,
    );
    return sourceExtensions(output).map((extension) =>
      path.join(this.resolvedRoot(), stem + extension),
    );
  }

  /**
   * Outputs whose source is itself a symbolic link, collected once. Only a
   * lookup every cheaper set missed pays for it.
   */
  private linkedOutputs(): readonly string[] {
    if (this.linked !== undefined) return this.linked;
    const linked: string[] = [];
    for (const outputs of this.outputBuckets().values()) {
      for (const output of outputs) {
        if (this.sourceCandidates(output).some(isSymbolicLink)) {
          linked.push(output);
        }
      }
    }
    this.linked = linked;
    return linked;
  }

  private resolvedRoot(): string {
    this.physicalRoot ??= this.identities.resolve(this.rootDir).path;
    return this.physicalRoot;
  }

  private resolvedEmitDir(): string {
    this.physicalEmitDir ??= this.identities.resolve(this.emitDir).path;
    return this.physicalEmitDir;
  }

  /** The build's record, taken now when the constructor was given none. */
  private recordedOutputs(): ReadonlySet<string> {
    this.recorded ??= new Set(
      EmitOwnershipIndex.listOutputs(this.resolvedEmitDir()),
    );
    return this.recorded;
  }

  /**
   * Every recorded output as an absolute path, grouped by lower-cased file stem
   * so the inverse lookup only resolves outputs that could be the one asked
   * for.
   */
  private outputBuckets(): Map<string, string[]> {
    if (this.buckets !== undefined) return this.buckets;
    const buckets = new Map<string, string[]>();
    const add = (key: string, file: string): void => {
      const bucket = buckets.get(key);
      if (bucket === undefined) buckets.set(key, [file]);
      else bucket.push(file);
    };
    for (const output of this.recordedOutputs()) {
      const location = path.join(this.resolvedEmitDir(), output);
      add(bucketKey(location), location);
      if (process.platform === "win32" && path.basename(output).includes("~")) {
        add(SHORT_NAME_BUCKET, location);
      }
    }
    this.buckets = buckets;
    return buckets;
  }
}

/** One existing source an output could have been compiled from. */
interface SourceCandidate {
  /** Its filesystem identity. */
  key: string;
  /** Whether it is TypeScript rather than JavaScript under `allowJs`. */
  typescript: boolean;
}

/** Bucket of outputs whose own name may be a Windows 8.3 short name. */
const SHORT_NAME_BUCKET = "\0short-name";

/**
 * JavaScript extensions the compiler can write for a source file. JSX
 * `preserve` writes a `.tsx` or `.jsx` input as `.jsx`; every other JSX mode
 * writes `.js`.
 */
function emittedExtensions(source: string): readonly string[] {
  switch (path.extname(source).toLowerCase()) {
    case ".ts":
    case ".js":
      return [".js"];
    case ".tsx":
    case ".jsx":
      return [".js", ".jsx"];
    case ".mts":
    case ".mjs":
      return [".mjs"];
    case ".cts":
    case ".cjs":
      return [".cjs"];
    default:
      return [];
  }
}

/** Source extensions the compiler writes a given JavaScript output from. */
function sourceExtensions(output: string): readonly string[] {
  switch (path.extname(output).toLowerCase()) {
    case ".js":
      return [".ts", ".tsx", ".js", ".jsx"];
    case ".jsx":
      return [".tsx", ".jsx"];
    case ".mjs":
      return [".mts", ".mjs"];
    case ".cjs":
      return [".cts", ".cjs"];
    default:
      return [];
  }
}

/**
 * Lower-cased file stem, the one part a source and its output always share
 * short of an 8.3 alias. `x.d.ts` keeps its `.d`, so a declaration file never
 * meets the output of `x.ts`.
 */
function bucketKey(file: string): string {
  const base = path.basename(file);
  return base.slice(0, base.length - path.extname(base).length).toLowerCase();
}

function isSymbolicLink(location: string): boolean {
  try {
    return fs.lstatSync(location).isSymbolicLink();
  } catch {
    return false;
  }
}

function isFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}
