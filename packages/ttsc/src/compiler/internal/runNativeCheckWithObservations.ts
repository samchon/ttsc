import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";

/**
 * Execute a check with its same-generation input observations, preserving the
 * selected host, original diagnostics, streams and status.
 *
 * An opted-in host writes a private sidecar even when its check fails. Hosts
 * without that transport run their original command under their existing
 * descriptor and declared-input contract; omission does not assert complete
 * driver observations. No check is rerun to infer what the earlier generation
 * read. Missing metadata after an interrupted failed opted-in check likewise
 * withholds reuse; missing or malformed successful metadata is a protocol
 * error, not an empty proof.
 *
 * The callback receives only additional transport arguments. This operation
 * owns their accepted canonical private directory and attempts file and empty
 * directory removal without recursive deletion. Setup observes ownership before
 * entering the cleanup boundary, so a setup observation failure can leave the
 * allocation unclaimed. Cleanup failures retain the original
 * thrown failure or completed result as their cause. Before reading and
 * removing the artifact, the parent must still have its captured native
 * identity; a replaced directory is left untouched and reported as failure.
 * These observations do not provide an atomic descriptor or ABA guarantee.
 *
 * @evidence contracts/common.md#principled-implementation Only the selected check generation's explicitly negotiated sidecar carries driver-observed input states; hosts with a different observation contract keep their original command and declared-input authority without fabricating driver completeness or incompleteness.
 * @evidence contracts/common.md#clear-and-simple-design One adapter owns negotiation, strict wire decoding and private artifact lifetime; its callback retains command and diagnostic normalization ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither a later project-input query nor a separate transform can reconstruct check observations; unknown hosts receive no guessed flag and malformed metadata cannot become a complete empty observation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish failed-check metadata, unavailable transport, protocol errors and cleanup ownership, with body and tags separated according to the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Node native absolute paths locate the canonical private artifact, and an additional argv element conveys it without shell quoting or platform-specific filename guesses.
 * @evidence contracts/performance.md#efficient-algorithms One original check callback runs; this adapter adds canonical temp acquisition/native ownership observations, complete sidecar read/JSON decoding and indexed input membership/witness validation. Work and temporary storage follow wire/path bytes and declared inputs plus delegated check runtime; it does not add a second compiler generation or source-content rehash, and supplies no callback timeout or metadata-byte ceiling.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This adapter supplies the generation's proof to its cache owner rather than retaining or sharing a completed check itself.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources An accepted post-setup directory/artifact reaches ownership-checked cleanup attempts on success and failure; setup ownership observation occurs before this try/finally and can leave the allocation unclaimed. A replaced parent stays untouched, and ownership/removal failures preserve the primary outcome without certifying release. Wire text and parsed/witness records grow without a metadata-byte ceiling; accepted records transfer to the caller.
 */
export function runNativeCheckWithObservations(
  plugin: Pick<ITtscLoadedNativePlugin, "capabilities">,
  run: (extraArgs: readonly string[]) => TtscBuildResult,
): TtscBuildResult {
  if (plugin.capabilities?.checkObservations !== true) return run([]);

  const directory = createCanonicalTempDirectory("ttsc-check-observations-");
  const ownership = fs.lstatSync(directory);
  const file = path.join(directory, "observations.json");
  let completed: TtscBuildResult | undefined;
  let failed = false;
  let failure: unknown;
  try {
    completed = run(["--check-observations-json=" + file]);
    if (completed.processCompletedNormally !== true)
      return { ...completed, observationsComplete: false };
    let text: string;
    try {
      assertDirectoryOwnership(directory, ownership);
      if (!fs.lstatSync(file).isFile())
        throw new Error("check observation artifact is not an ordinary file");
      text = fs.readFileSync(file, "utf8");
    } catch (error) {
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
  | "hostInputs"
  | "hostInputHashes"
  | "hostInputRealpaths"
  | "observationsComplete"
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
  return {
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
