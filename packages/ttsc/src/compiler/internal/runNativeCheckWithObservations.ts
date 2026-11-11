import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { parseEnvironmentInputs } from "./parseEnvironmentInputs";
import {
  parseGraphInputObservations,
  parseReferenceGraph,
} from "./parseNativeTransformOutput";

/**
 * Execute a check or opted-in build with same-generation input observations,
 * preserving the selected host, original diagnostics, streams and status.
 *
 * The selected native verb must be check, or build with the separate
 * emitObservations capability, before negotiating its generation channel. A
 * check-stage descriptor can also serve effectful fix/format verbs; those
 * retain their original result and never acquire an invented check graph. An
 * opted-in host writes a private sidecar even when its check fails. Hosts
 * without that transport run their original command under their existing
 * descriptor and declared-input contract; omission does not assert complete
 * driver observations. No check is rerun to infer what the earlier generation
 * read. Missing metadata after an interrupted failed opted-in check likewise
 * withholds reuse. Missing or malformed successful check metadata is a protocol
 * error. Build metadata is optional cache evidence: unavailable setup, records
 * or cleanup retain the original build result with incomplete observations, so
 * loss of caching cannot turn a fresh successful emit into failure.
 *
 * The callback receives only additional transport arguments. This operation
 * owns their accepted canonical private directory and attempts file and empty
 * directory removal without recursive deletion. Setup observes ownership before
 * entering the cleanup boundary, so a setup observation failure can leave the
 * allocation unclaimed. Cleanup failures retain the original thrown failure or
 * completed check result as their cause. Before reading and removing the
 * artifact, the parent must still have its captured native identity; a replaced
 * directory is left untouched and withholds build reuse or reports check
 * failure. These observations do not provide an atomic descriptor or ABA
 * guarantee.
 *
 * @evidence contracts/common.md#principled-implementation Actual check and build verbs negotiate independent declared observation capabilities; fix/format verbs retain their own result. Build witness IO/protocol failures preserve the one original build with incomplete observations, while checks retain their strict metadata contract. Legacy hosts keep their original command without fabricated completeness.
 * @evidence contracts/common.md#clear-and-simple-design The actual verb and descriptor opt-in jointly select one adapter for strict wire decoding and private artifact lifetime; its callback retains command and diagnostic normalization ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither a later project-input query nor a separate transform can reconstruct check observations; unknown hosts receive no guessed flag and malformed metadata cannot become a complete empty observation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish failed-check metadata, unavailable transport, protocol errors and cleanup ownership, with body and tags separated according to the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node native absolute paths locate the canonical private artifact, and an additional argv element conveys it without shell quoting or platform-specific filename guesses.
 * @evidence contracts/performance.md#efficient-algorithms One original check or build callback runs; this adapter adds canonical temp acquisition/native ownership observations, complete sidecar read/JSON decoding and indexed input membership/witness validation. Work and temporary storage follow wire/path bytes and declared inputs plus delegated producer runtime; it does not add a second compiler generation or source-content rehash, and supplies no callback timeout or metadata-byte ceiling.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This adapter supplies the generation's proof to its cache owner rather than retaining or sharing a completed check itself.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources An accepted post-setup directory/artifact reaches ownership-checked cleanup attempts on success and failure; setup ownership observation occurs before this try/finally and can leave the allocation unclaimed. A replaced parent stays untouched, and ownership/removal failures preserve the primary outcome without certifying release. Wire text and parsed/witness records grow without a metadata-byte ceiling; accepted records transfer to the caller.
 */
export function runNativeCheckWithObservations(
  plugin: Pick<ITtscLoadedNativePlugin, "capabilities">,
  run: (extraArgs: readonly string[]) => TtscBuildResult,
  /** Actual argv verb; legacy direct callers already represent a check. */
  command: string = "check",
): TtscBuildResult {
  const emitting =
    command === "build" && plugin.capabilities?.emitObservations === true;
  if (
    !emitting &&
    (command !== "check" || plugin.capabilities?.checkObservations !== true)
  )
    return run([]);

  let directory: string;
  let ownership: fs.Stats;
  try {
    directory = createCanonicalTempDirectory("ttsc-check-observations-");
    ownership = fs.lstatSync(directory);
  } catch (error) {
    if (emitting) return { ...run([]), observationsComplete: false };
    throw error;
  }
  const file = path.join(directory, "observations.json");
  let completed: TtscBuildResult | undefined;
  let failed = false;
  let failure: unknown;
  try {
    completed = run([
      (emitting ? "--emit-observations-json=" : "--check-observations-json=") +
        file,
    ]);
    if (completed.processCompletedNormally !== true)
      return { ...completed, observationsComplete: false };
    let text: string;
    try {
      assertDirectoryOwnership(directory, ownership);
      if (!fs.lstatSync(file).isFile())
        throw new Error("check observation artifact is not an ordinary file");
      text = fs.readFileSync(file, "utf8");
    } catch (error) {
      if (emitting) return { ...completed, observationsComplete: false };
      if (
        completed.status !== 0 &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      )
        return { ...completed, observationsComplete: false };
      throw new Error("ttsc: check observation metadata is unavailable", {
        cause: new AggregateError([completed, error]),
      });
    }
    try {
      return { ...completed, ...parseObservations(JSON.parse(text)) };
    } catch (error) {
      if (emitting) return { ...completed, observationsComplete: false };
      throw new Error("ttsc: invalid check observation metadata", {
        cause: new AggregateError([completed, error]),
      });
    }
  } catch (error) {
    failed = true;
    failure = error;
    throw error;
  } finally {
    const errors: unknown[] = [];
    try {
      assertDirectoryOwnership(directory, ownership);
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 0) {
      try {
        fs.rmSync(file, { force: true });
      } catch (error) {
        errors.push(error);
      }
      try {
        fs.rmdirSync(directory);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length !== 0) {
      if (emitting && completed !== undefined && !failed)
        return { ...completed, observationsComplete: false };
      const primary = failed ? failure : completed;
      throw new AggregateError(
        [primary, ...errors],
        "ttsc: check observation artifact cleanup failed",
        { cause: primary },
      );
    }
  }
}

/** Refuse artifact IO or removal through a replaced private directory. */
function assertDirectoryOwnership(directory: string, captured: fs.Stats): void {
  const current = fs.lstatSync(directory);
  if (
    !current.isDirectory() ||
    current.isSymbolicLink() ||
    current.dev !== captured.dev ||
    current.ino !== captured.ino
  )
    throw new Error("ttsc: check observation directory ownership changed");
}

/** Decode declared native inputs without refreshing producer observations. */
function parseObservations(
  value: unknown,
): Pick<
  TtscBuildResult,
  | "environmentInputs"
  | "hostInputs"
  | "hostInputHashes"
  | "hostInputRealpaths"
  | "observationsComplete"
  | "graph"
  | "compilerObservations"
> {
  if (!isRecord(value) || !Array.isArray(value.hostInputs))
    throw new Error("expected an observation record and input list");
  if (
    value.observationsComplete !== undefined &&
    value.observationsComplete !== false
  )
    throw new Error("observation completeness must be absent or false");
  const inputs = new Set<string>();
  for (const input of value.hostInputs) {
    if (typeof input !== "string" || !path.isAbsolute(input))
      throw new Error("expected absolute native input paths");
    inputs.add(path.resolve(input));
  }
  const graph = parseReferenceGraph(value.graph);
  const graphUnavailable =
    graph === undefined ||
    (graph.inputHashes === undefined &&
      graph.inputObservations === undefined &&
      graph.inputRealpaths === undefined &&
      graph.inputProofFailures === undefined);
  const environmentInputs = parseEnvironmentInputs(value.environmentInputs);
  // The compiler's whole question population is proof only when the producer
  // called it complete and every entry is a well-formed predicate at an
  // absolute path; otherwise it is dropped whole, which costs reuse only.
  const compiler =
    value.compilerObservationsComplete === true
      ? parseGraphInputObservations(value.compilerObservations)
      : {};
  return {
    ...(compiler.observations !== undefined &&
    compiler.failures === undefined &&
    Object.keys(compiler.observations).every((file) => path.isAbsolute(file))
      ? { compilerObservations: compiler.observations }
      : {}),
    ...(environmentInputs === undefined ? {} : { environmentInputs }),
    ...(graph === undefined ? {} : { graph }),
    ...(graphUnavailable ? { observationsComplete: false as const } : {}),
    hostInputs: [...inputs],
    hostInputHashes: parseWitnesses(value.hostInputHashes, inputs, false),
    hostInputRealpaths: parseWitnesses(value.hostInputRealpaths, inputs, true),
    ...(value.observationsComplete === false
      ? { observationsComplete: false as const }
      : {}),
  };
}

/** Retain null witnesses and missing conflicting proofs as distinct states. */
function parseWitnesses(
  value: unknown,
  inputs: ReadonlySet<string>,
  physical: boolean,
): Record<string, string | null> {
  if (!isRecord(value)) throw new Error("expected an input witness record");
  const output: Record<string, string | null> = {};
  for (const [file, witness] of Object.entries(value)) {
    if (!path.isAbsolute(file) || !inputs.has(path.resolve(file)))
      throw new Error("witness key must identify a declared native input");
    if (
      witness !== null &&
      (typeof witness !== "string" ||
        (physical
          ? !path.isAbsolute(witness)
          : !/^[0-9a-f]{64}$/.test(witness)))
    )
      throw new Error("invalid input witness");
    const key = path.resolve(file);
    const normalized =
      physical && typeof witness === "string" ? path.resolve(witness) : witness;
    if (
      Object.prototype.hasOwnProperty.call(output, key) &&
      output[key] !== normalized
    )
      throw new Error("conflicting native input coordinates");
    output[key] = normalized as string | null;
  }
  return output;
}

/** JSON object records exclude scalar and array payloads. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
