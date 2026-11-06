import crypto from "node:crypto";
import fs from "node:fs";

import { E2ETrace } from "../../../internal/E2ETrace";
import { PluginContentIdentities } from "../../../plugin/internal/source/PluginContentIdentities";
import { CompilerArgumentsInspection } from "../CompilerArgumentsInspection";

/**
 * Reuse one selected population's content witnesses under separable native
 * metadata. Selection remains compiler-owned and is repeated by the caller;
 * this record never decides source membership or resolution.
 *
 * @evidence contracts/common.md#principled-implementation A complete selected-path vector and each current physical target, device, inode, mode, size, modification and change stamp qualify a record bracketed around actual byte reads; current absence is observed separately.
 * @evidence contracts/common.md#clear-and-simple-design One aggregate record shares content witnesses without adding a cache file or retained buffer per source.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The existing separable-reference policy gates metadata reuse; unavailable observations read real content, and compiler selection is never inferred from historical paths.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes content reuse from source selection and explains metadata authority and fallback.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath and bigint stat retain physical targets and device-specific stamp authority, without platform case guesses.
 * @evidence contracts/performance.md#efficient-algorithms Each proof observes N selected paths and serializes their metadata; an unchanged record avoids reading B source bytes and uses one aggregate record rather than N cache files.
 * @evidence contracts/performance.md#reuse-equivalent-work The store shares a population only for equal ordered paths, version and separable current physical/metadata signatures; additions, missing-to-present transitions and replacements change its authority.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The existing collected identity store owns one record per selected population; invocation-local arrays escape only as the returned snapshot witnesses, with no resident path history.
 */
export namespace RuntimeInputContents {
  /**
   * Capture raw SHA-256 and physical witnesses for an already selected closure.
   * Unknown devices and changing or unobservable metadata retain actual reads.
   *
   * @evidence contracts/common.md#principled-implementation A record's observer and reader cover exactly the ordered input vector; only ENOENT and ENOTDIR record absence, and decoded cached rows must match that vector and witness grammar.
   * @evidence contracts/common.md#clear-and-simple-design The identity store owns bracketed publication while this function owns population projection, byte reads and decoded witness validation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing records and invalid cached values run the real reader rather than supply empty or guessed hashes.
   * @evidence contracts/common.md#meaningful-documentation The prose states selected-closure scope, raw hash semantics and conservative metadata fallback.
   * @evidence contracts/portability.md#os-neutral-implementation Native physical paths and device references remain distinct from logical input spelling; non-missing filesystem errors cannot establish absence.
   * @evidence contracts/performance.md#efficient-algorithms One aggregate metadata scan precedes record lookup; a miss adds bracketed actual reads and another scan. Path and serialized witness bytes determine temporary allocation.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal separable metadata reuses previously read content across captures and processes while the caller still repeats actual compiler membership discovery.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The supplied store owns persistence and collection; this call retains no handles or historical map and returns one witness per selected path.
   */
  export function capture(
    inputs: readonly string[],
    subject: string,
    store: PluginContentIdentities.Store | undefined,
  ): [string, string | null, string | null][] {
    let contentReads = 0;
    const read = (): string =>
      JSON.stringify(
        inputs.map((file) => {
          try {
            const observed = JSON.parse(
              CompilerArgumentsInspection.observeInputFile(file),
            );
            contentReads++;
            return [file, observed[0], observed[2]];
          } catch (error) {
            if (!missing(error)) throw error;
            return [file, null, null];
          }
        }),
      );
    const value = PluginContentIdentities.digest(
      store,
      "runtime-input-content:" +
        crypto
          .createHash("sha256")
          .update(JSON.stringify(inputs))
          .digest("hex"),
      subject,
      (references) => {
        const signatures: unknown[] = [];
        let separable = true;
        for (const file of inputs) {
          try {
            const physical = fs.realpathSync.native(file);
            const observation = PluginContentIdentities.fileObservation(
              references,
              file,
            );
            if (observation === undefined) return undefined;
            separable &&= observation.separable;
            signatures.push([file, physical, observation.signature]);
          } catch (error) {
            if (!missing(error)) return undefined;
            signatures.push([file, null]);
          }
        }
        return { separable, signature: JSON.stringify(signatures) };
      },
      read,
    );
    const decode = (
      text: string,
    ): [string, string | null, string | null][] | undefined => {
      try {
        const rows: unknown = JSON.parse(text);
        if (
          !Array.isArray(rows) ||
          rows.length !== inputs.length ||
          !rows.every(
            (row, i) =>
              Array.isArray(row) &&
              row.length === 3 &&
              row[0] === inputs[i] &&
              ((row[1] === null && row[2] === null) ||
                (typeof row[1] === "string" &&
                  typeof row[2] === "string" &&
                  /^[a-f0-9]{64}$/.test(row[2]))),
          )
        )
          return undefined;
        return rows as [string, string | null, string | null][];
      } catch {
        return undefined;
      }
    };
    const captured = decode(value) ?? decode(read())!;
    E2ETrace.capabilityResolution("runtime-input-content", {
      project: subject,
      inputs: inputs.length,
      contentReads,
    });
    return captured;
  }

  /** Only native absent-path errors authorize a missing input witness. */
  function missing(error: unknown): boolean {
    return (
      (error as NodeJS.ErrnoException)?.code === "ENOENT" ||
      (error as NodeJS.ErrnoException)?.code === "ENOTDIR"
    );
  }
}
