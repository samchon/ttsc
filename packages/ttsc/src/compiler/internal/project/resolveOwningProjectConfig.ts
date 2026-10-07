import fs from "node:fs";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../../internal/pathIdentity/createFilesystemPathIdentityContext";
import { outputText } from "../outputText";
import { resolveTsgo } from "../resolveTsgo";
import { spawnNative } from "../spawnNative";
import { readJsoncFile } from "./readJsoncFile";
import { selectReferencedProject } from "./selectReferencedProject";

/**
 * The project that owns `file`: the discovered `tsconfig` itself, or the
 * project it references that contains the file.
 *
 * A solution-style config (`"files": []` plus `references`) owns no files; it
 * delegates them. Vite, Nx, and many monorepo templates generate that layout,
 * and a runner that stops at the nearest config compiles the file with the
 * solution's empty options while the editor, which follows the references,
 * shows no error. This lookup selects within the declared reference graph:
 *
 * 1. A config that declares no `references` owns the file. Nothing is spawned, so
 *    an ordinary project avoids compiler expansion but still reads its config.
 * 2. Otherwise, the config owns the file when its own root files contain it.
 * 3. Otherwise, each reference in declaration order: a referenced config that
 *    contains the file owns it; one that does not is searched through its own
 *    references, depth-first. A reference names a config file or a directory
 *    holding `tsconfig.json`, and a cycle is visited once.
 * 4. When no project contains the file, the discovered config is kept, so the file
 *    takes the same out-of-`include` lane it always did.
 *
 * Containment is the compiler's own answer, not a reimplementation of
 * `include`/`exclude` matching: `--showConfig` lists the root files a config
 * expands to, and each is compared with the file by filesystem identity.
 * `references` are read from the config itself, because TypeScript never
 * inherits them through `extends`. Read/parse failures supply no reference
 * edges; failed compiler invocations or malformed output supply no positive
 * membership observation. The original discovered config is then a fallback,
 * not proof that it contains the file. Identity comparisons use observed
 * realpaths and case capabilities, retaining best-effort spelling when native
 * identity lookup is unavailable.
 *
 * Graph observations are shared only within this lookup. Later requests can see
 * changed configs, inherited options, directory membership or compiler inputs;
 * a config pathname alone cannot establish that the expansion is still valid.
 * The callback observes direct config reads, not every inherited config or
 * compiler input consulted by expansion. Synchronous compiler work has no
 * explicit execution deadline in this operation.
 *
 * @param props.tsconfig - The config project discovery found for the file.
 * @param props.file - The file whose project is asked for.
 * @param props.binary - An explicit TypeScript-Go binary, when one was given.
 * @param props.onConfig - Called with every config this reads, so a caller that
 *   fingerprints its inputs can record them.
 * @evidence contracts/common.md#principled-implementation Successful compiler showConfig supplies root membership observations, best-effort filesystem identity compares aliases, and visited identity keys terminate repeated graph states while declaration-order DFS selects the first observed containing project. Failed observations preserve the discovered fallback without certifying membership.
 * @evidence contracts/common.md#clear-and-simple-design Reference reading, compiler expansion and membership comparison have separate local responsibilities; discovery retains its original fallback when no referenced project contains the target.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Solution handling follows references and actual compiler root lists rather than guessed include patterns or named project layouts; stale cross-request answers are not preserved by compensating target checks.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state ownership order, fallback, callbacks and lookup-scoped reuse, with parameter explanations separated from acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation Node path operations select native config spellings, actual filesystem identity compares target and roots, and spawnNative owns executable representation rather than applying OS-name case guesses.
 * @evidence contracts/performance.md#efficient-algorithms Each distinct observed config identity key is visited once in the DFS and receives at most one expansion plus one ctime-based retry; ctime can change for metadata updates as well as creation. Direct config reads/parsing, reference path text/stat work, delegated identity/case probes and binary selection precede or accompany compiler execution. Root-list decoding and membership scans cost their bytes and entries; DFS stack depth follows the reference chain and native recursion limits still apply. The no-reference path avoids a compiler subprocess, not config I/O.
 * @evidence contracts/performance.md#reuse-equivalent-work The lookup reuses discovered reference edges and filesystem identity observations; visited keys prevent expansion of a repeated observed identity, while later requests rerun because paths alone cannot prove unchanged inheritance, directory membership or compiler selection. Best-effort identity cannot guarantee deduplication of every physical alias.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Identity maps, visited keys and root observations are lookup-local with no historical population retained here. Synchronous expansion delegates capture cleanup to spawnNative's finally path, whose cleanup failures are suppressed; output storage and child duration have no configured ceiling here. A nonterminating child prevents the lookup from finishing, rather than being released by this graph traversal.
 */
export function resolveOwningProjectConfig(props: {
  /** Absolute or invocation-relative spelling of the discovered config. */
  tsconfig: string;

  /** Native target path whose root-file membership is being resolved. */
  file: string;

  /**
   * Explicit compiler executable; otherwise resolution selects the installed
   * compiler.
   */
  binary?: string;

  /** Observe each directly read config, including ones with no reference edges. */
  onConfig?: (config: string) => void;
}): string {
  const discovered = path.resolve(props.tsconfig);
  const discoveredReferences = readReferences(discovered, props.onConfig);
  if (discoveredReferences.length === 0) {
    return discovered;
  }
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  const target = identities.resolve(path.resolve(props.file)).key;
  /**
   * Compare a compiler root observation with this lookup's target identity.
   *
   * Equal keys compare this lookup's best-effort identity observations; native
   * lookup failures do not prove physical equivalence. A scan shares the
   * identity context; no guessed suffix matching, separate membership index or
   * historical cache is introduced for this one target.
   */
  function listed(roots: RootFiles): boolean {
    return roots.files.some((root) => identities.resolve(root).key === target);
  }

  /**
   * Ask whether one project's expanded roots contain the target, retrying once
   * when target metadata indicates creation during the expansion interval.
   *
   * This closure owns the bounded retry, while rootFiles owns compiler
   * execution and listed owns filesystem identity comparison. The ctime
   * observation is a race premise, not an atomic snapshot or an arbitrary
   * delay. Both attempts finish synchronously and only this call retains its
   * root observations.
   */
  function contains(config: string): boolean {
    const roots = rootFiles(config, props.binary);
    if (listed(roots)) return true;
    // Recent ctime permits one retry after a miss; it can reflect a metadata
    // change rather than creation and is not an atomic freshness proof.
    return (
      createdSince(props.file, roots.takenAt) &&
      listed(rootFiles(config, props.binary))
    );
  }
  return selectReferencedProject(discovered, discoveredReferences, {
    identity: (config) => identities.resolve(config).key,
    contains,
    readReferences: (config) => readReferences(config, props.onConfig),
  });
}

/**
 * The config files `config` references, resolved, in declaration order. A
 * reference that names nothing on disk is skipped, as the compiler reports it
 * on its own.
 *
 * Only string paths in a references array become candidates. Node anchors them
 * at this config's native directory and stat distinguishes files from directory
 * shorthand. References are direct edges, not inherited through extends.
 *
 * One pass preserves declaration order without sorting. The caller's visited
 * set prevents duplicate config traversal; this helper retains no historical
 * graph and rereads current edges for a later request.
 */
function readReferences(
  config: string,
  onConfig: ((config: string) => void) | undefined,
): string[] {
  onConfig?.(config);
  let parsed: unknown;
  try {
    parsed = readJsoncFile(config);
  } catch {
    return [];
  }
  const references = (parsed as { references?: unknown }).references;
  if (!Array.isArray(references)) return [];
  const out: string[] = [];
  for (const reference of references) {
    const spelled = (reference as { path?: unknown } | null)?.path;
    if (typeof spelled !== "string") continue;
    const target = path.resolve(path.dirname(config), spelled);
    const file = isDirectory(target)
      ? path.join(target, "tsconfig.json")
      : target;
    if (isFile(file)) out.push(file);
  }
  return out;
}

/**
 * One compiler root-list observation and its wall-clock start time. The
 * timestamp permits one retry when the target was created during expansion.
 *
 * Native root paths remain an array because the consumer compares one target
 * with a short-circuit scan. This carrier neither proves reuse validity nor
 * owns cache lifetime; the current containment call owns its observation.
 */
interface RootFiles {
  /** Absolute paths, as the compiler listed them. */
  files: readonly string[];

  /** `Date.now()` just before the compiler was asked. */
  takenAt: number;
}

/**
 * The root files `config` expands to, as the compiler reports them. An empty
 * list when the compiler cannot load the config, which then owns nothing.
 *
 * There is no cross-request cache. The enclosing graph traversal expands each
 * visited project once, except for its single concurrent-target retry. Failed
 * invocations and malformed output remain retryable observations rather than
 * permanent empty project answers.
 *
 * `resolveTsgo` and `spawnNative` own executable selection and argument
 * boundaries. Only string file entries become native paths relative to the
 * config directory; include patterns and inherited options are interpreted by
 * the compiler itself.
 *
 * Each expansion uses one completed synchronous subprocess and linear decoding
 * of reported files. The caller owns graph deduplication and one binary
 * selection per project; output temporaries are not retained after decoding. No
 * include approximation or permanent failed answer substitutes for compiler
 * behavior.
 */
function rootFiles(config: string, binary: string | undefined): RootFiles {
  const takenAt = Date.now();
  let files: string[] = [];
  try {
    const directory = path.dirname(config);
    const tsgo = resolveTsgo({ binary, cwd: directory });
    const result = spawnNative(tsgo.binary, ["-p", config, "--showConfig"], {
      cwd: directory,
      encoding: "utf8",
    });
    if (result.status === 0) {
      const shown = JSON.parse(outputText(result.stdout)) as {
        files?: unknown;
      };
      if (Array.isArray(shown.files)) {
        files = shown.files
          .filter((file): file is string => typeof file === "string")
          .map((file) => path.resolve(directory, file));
      }
    }
  } catch {
    files = [];
  }
  const roots = { files, takenAt };
  return roots;
}

/**
 * Whether the target's reported metadata change time is at or after `time`.
 * Unlike modification time preserved by an ordinary copy, ctime can reveal
 * creation during compiler expansion. Filesystem clock precision can still
 * limit this race check; it is not a proof of an unchanged config snapshot.
 *
 * One native stat and millisecond comparison supplies this premise. Missing or
 * unreadable files supply no positive answer. Retry count stays with the
 * caller; this helper owns no retained handle, cache, shell probe or delayed
 * task.
 */
function createdSince(file: string, time: number): boolean {
  try {
    return fs.statSync(file).ctimeMs >= time;
  } catch {
    return false;
  }
}

/**
 * Whether a native reference path currently names a directory. Stat failures
 * supply no positive classification; compiler diagnostics own them.
 *
 * Node stat follows symlinks and reads the directory bit without traversing
 * contents. Classification is current rather than inferred from separators or
 * cached across mutations, and the synchronous request retains no descriptor.
 */
function isDirectory(location: string): boolean {
  try {
    return fs.statSync(location).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Whether a native candidate currently names a regular file. Stat failures
 * exclude the candidate and remain for compiler diagnostics.
 *
 * One Node stat follows symlinks and reads the regular-file bit, rather than
 * guessing from extensions or enumerating directory contents. It retains no
 * descriptor or classification across later filesystem mutations.
 */
function isFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}
