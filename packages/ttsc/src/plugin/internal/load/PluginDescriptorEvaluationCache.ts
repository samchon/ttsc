import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveSourceBuildCachePaths } from "../source/resolveSourceBuildCachePaths";
import { hashHostInputPaths } from "./hashHostInputPaths";
import { realpathHostInputPaths } from "./realpathHostInputPaths";

/**
 * The persistent answers of isolated CommonJS descriptor evaluations, each
 * recorded with the state it was computed from (samchon/ttsc#1497).
 *
 * Evaluating a descriptor spawns a runtime that loads the descriptor graph in a
 * fresh module cache: seconds per launch on Windows, repeated by every `ttsc`
 * and `ttsx` launch of an unchanged project. The evaluation already proves what
 * it read, each module the graph loaded and each candidate it probed, with the
 * content and physical path it saw during the evaluation. An answer is kept
 * under everything else the evaluation was given: the descriptor, its factory
 * context, the complete environment it ran under, the runtime that ran it, and
 * this ttsc build. It is handed out only while every input it read still has
 * the state it was read in.
 *
 * The files a descriptor reads outside its module graph are its own to declare
 * (`hostInputs` with `hostInputHashes`), the contract every host input cache
 * relies on; a declared fingerprint is proven like a module the graph loaded.
 * An evaluation that could not prove an input is not recorded, and neither is
 * one that printed anything, since a hit replays nothing.
 */
export namespace PluginDescriptorEvaluationCache {
  /** One evaluation's answer and the state it was computed from. */
  export interface IEvaluation {
    descriptor: unknown;
    hostInputHashes: Record<string, string | null>;
    hostInputRealpaths: Record<string, string | null>;
    inputs: string[];
  }

  /**
   * Where the answer for one evaluation lives, or `null` when no cache root can
   * be resolved or the runtime cannot be identified.
   *
   * @param props.projectRoot The project whose cache root holds the entry.
   * @param props.cacheDir The plugin cache directory the caller selected.
   * @param props.request The resolved descriptor module.
   * @param props.context The factory context the descriptor is invoked with.
   * @param props.env The complete environment the evaluation runs under.
   * @param props.runtime The runtime executable that evaluates it.
   * @param props.version This ttsc build's version.
   */
  export function locate(props: {
    cacheDir: string | undefined;
    context: unknown;
    env: NodeJS.ProcessEnv;
    projectRoot: string;
    request: string;
    runtime: string;
    version: string;
  }): string | null {
    const runtime = runtimeIdentity(props.runtime);
    if (runtime === null) return null;
    let root: string;
    try {
      root = resolveSourceBuildCachePaths(
        props.projectRoot,
        props.cacheDir,
        props.env,
      ).root;
    } catch {
      return null;
    }
    const key = crypto
      .createHash("sha256")
      .update(
        JSON.stringify([
          FORMAT,
          props.version,
          path.resolve(props.request),
          props.context,
          Object.entries(props.env)
            .filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            )
            .sort(([left], [right]) =>
              left < right ? -1 : left > right ? 1 : 0,
            ),
          runtime,
        ]),
      )
      .digest("hex");
    return path.join(root, "descriptors", `${key}.json`);
  }

  /**
   * The recorded answer, or `null` when there is none whose inputs all still
   * hold the state they were read in. Every failure to prove it is `null`,
   * which means "evaluate the descriptor".
   */
  export function read(file: string): IEvaluation | null {
    let entry: unknown;
    try {
      entry = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
    if (!isEntry(entry) || entry.format !== FORMAT) return null;
    const hashed = Object.keys(entry.proof.hashes);
    if (
      hashed.length === 0 ||
      !sameMap(entry.proof.hashes, hashHostInputPaths(hashed)) ||
      !sameMap(
        entry.proof.realpaths,
        realpathHostInputPaths(Object.keys(entry.proof.realpaths)),
      )
    )
      return null;
    return entry.evaluation;
  }

  /**
   * Record an evaluation's answer with the state it was computed from.
   *
   * The state is the one the evaluation proved while it ran, never a reading
   * taken now: hashing the inputs here would pair the answer with a state it
   * may not have been computed from (samchon/ttsc#1504). An input without both
   * proofs, or a declared input whose fingerprint the evaluation did not give,
   * leaves nothing that could prove the entry later, so nothing is recorded. A
   * write failure only costs the next launch an evaluation.
   */
  export function write(file: string, evaluation: IEvaluation): void {
    const hashes: Record<string, string | null> = {};
    const realpaths: Record<string, string | null> = {};
    for (const input of new Set(
      evaluation.inputs.map((input) => path.resolve(input)),
    )) {
      if (
        !Object.prototype.hasOwnProperty.call(
          evaluation.hostInputHashes,
          input,
        ) ||
        !Object.prototype.hasOwnProperty.call(
          evaluation.hostInputRealpaths,
          input,
        )
      )
        return;
      hashes[input] = evaluation.hostInputHashes[input]!;
      realpaths[input] = evaluation.hostInputRealpaths[input]!;
    }
    const declared = declaredFingerprints(evaluation.descriptor);
    if (declared === null) return;
    for (const [input, hash] of Object.entries(declared)) {
      if (
        Object.prototype.hasOwnProperty.call(hashes, input) &&
        hashes[input] !== hash
      )
        return;
      // The descriptor's fingerprint of a file it read itself proves its
      // content; the physical path is proven only for what the evaluation saw.
      hashes[input] = hash;
    }
    if (Object.keys(hashes).length === 0) return;
    const entry: IEntry = {
      evaluation,
      format: FORMAT,
      proof: { hashes, realpaths },
    };
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // Written beside the entry and renamed, so a reader never sees a partial
      // entry that happens to parse.
      const staging = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(staging, JSON.stringify(entry), "utf8");
      try {
        fs.renameSync(staging, file);
      } catch {
        fs.rmSync(staging, { force: true });
      }
    } catch {
      // The cache is an optimization over an evaluation that still works.
    }
  }

  /**
   * Entry format tag. Moves when the entry shape or its proof rule changes, so
   * an entry written under another rule is evaluated again.
   */
  const FORMAT = "ttsc-descriptor-evaluation-v1";

  interface IEntry {
    evaluation: IEvaluation;
    format: string;
    proof: {
      hashes: Record<string, string | null>;
      realpaths: Record<string, string | null>;
    };
  }

  /**
   * The runtime executable as the key names it: its physical path with the
   * metadata a replacement moves, so an upgraded runtime at the same path
   * evaluates again. `null` when it cannot be read.
   */
  function runtimeIdentity(runtime: string): string | null {
    try {
      const real = fs.realpathSync.native(runtime);
      const stat = fs.statSync(real, { bigint: true });
      return [
        real,
        stat.dev,
        stat.ino,
        stat.size,
        stat.mtimeNs,
        stat.ctimeNs,
      ].join(":");
    } catch {
      return null;
    }
  }

  /**
   * The fingerprints a descriptor declared for the files it read itself
   * (`hostInputHashes`), keyed by resolved path; `{}` when it declared none,
   * and `null` when the declaration is not one a proof can use.
   */
  function declaredFingerprints(
    descriptor: unknown,
  ): Record<string, string | null> | null {
    if (typeof descriptor !== "object" || descriptor === null) return {};
    const declared = (descriptor as { hostInputHashes?: unknown })
      .hostInputHashes;
    if (declared === undefined) return {};
    if (typeof declared !== "object" || declared === null) return null;
    const output: Record<string, string | null> = {};
    for (const [file, hash] of Object.entries(declared)) {
      if (!path.isAbsolute(file) || (hash !== null && typeof hash !== "string"))
        return null;
      output[path.resolve(file)] = hash;
    }
    return output;
  }

  function isEntry(value: unknown): value is IEntry {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as Partial<IEntry>;
    const evaluation = entry.evaluation as Partial<IEvaluation> | undefined;
    return (
      typeof entry.format === "string" &&
      typeof entry.proof === "object" &&
      entry.proof !== null &&
      isStateMap(entry.proof.hashes) &&
      isStateMap(entry.proof.realpaths) &&
      typeof evaluation === "object" &&
      evaluation !== null &&
      isStateMap(evaluation.hostInputHashes) &&
      isStateMap(evaluation.hostInputRealpaths) &&
      Array.isArray(evaluation.inputs) &&
      evaluation.inputs.every((input) => typeof input === "string")
    );
  }

  function isStateMap(value: unknown): value is Record<string, string | null> {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).every(
        (state) => state === null || typeof state === "string",
      )
    );
  }

  /**
   * Whether two snapshots describe the same state, compared both ways: a key
   * the fresh snapshot lacks means the two were taken over different sets.
   */
  function sameMap(
    recorded: Record<string, string | null>,
    current: Record<string, string | null>,
  ): boolean {
    const keys = Object.keys(recorded);
    if (keys.length !== Object.keys(current).length) return false;
    return keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(current, key) &&
        recorded[key] === current[key],
    );
  }
}
