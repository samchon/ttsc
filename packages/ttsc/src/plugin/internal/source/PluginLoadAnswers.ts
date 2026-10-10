import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "../../../internal/E2ETrace";
import type { PluginContentIdentities } from "./PluginContentIdentities";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { recordCacheFileUse } from "./recordCacheFileUse";

/**
 * Answers a plugin load computed from inputs it could identify by content, kept
 * in the plugin cache root under that identity so a later process with equal
 * inputs reads the answer instead of computing it again.
 *
 * WARNING (#1721, #1723): the key is the whole proof. A caller must fold into
 * `identity` every input that can change the answer, as content identities
 * (`PluginContentIdentities`) or the authoritative live probe results, never a
 * path, a timestamp or a value it merely expects to be stable. An answer is
 * written only after the computation succeeded on inputs the caller proved
 * unchanged around it; a failed or unproved computation is never recorded,
 * since a later process could not tell it from a current one.
 *
 * Entries are single files published by rename, aged out by the single-file
 * collector and removed by `ttsc clean`. Their identity includes the format tag
 * and the ttsc version, so another release never reads them.
 *
 * @evidence contracts/common.md#principled-implementation The content-addressed key carries every caller-declared input identity; reads accept only a matching format, version and kind, and writes are refused for unproved computations by the caller contract.
 * @evidence contracts/common.md#clear-and-simple-design One owner stores and loads opaque answers; callers own key composition, validation of the answer shape and the decision to record.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No answer is guessed; a missing, corrupt or foreign entry is a miss and the caller computes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the key contract that prevents stale answers, the recording rule and the storage lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joins and same-directory rename publication; keys are hashed text, independent of path dialect.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Members state their own costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Members define reuse through the caller's identity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Members state retention; the namespace holds no state.
 */
export namespace PluginLoadAnswers {
  /**
   * The answer recorded for `identity`, or `undefined` when none is.
   *
   * @param store The opened store, or `undefined` for no persistence.
   * @param kind Answer family; families never share entries.
   * @param identity Every input identity the answer depends on.
   * @evidence contracts/common.md#principled-implementation An entry is returned only for the same format, version, kind and identity hash; the caller validates the value's shape.
   * @evidence contracts/common.md#clear-and-simple-design One lookup returns an opaque value or undefined.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable or foreign entries are misses.
   * @evidence contracts/common.md#meaningful-documentation Parameters describe the identity contract.
   * @evidence contracts/portability.md#os-neutral-implementation Native path join and file read.
   * @evidence contracts/performance.md#efficient-algorithms Hashes the serialized identity and reads one small file; a hit refreshes its use time.
   * @evidence contracts/performance.md#reuse-equivalent-work Processes share an answer only for an identical serialized identity under the same version.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Nothing is retained in memory; the collector owns entry lifetime.
   */
  export function read(
    store: PluginContentIdentities.Store | undefined,
    kind: string,
    identity: unknown,
  ): unknown {
    if (store === undefined) return undefined;
    const file = answerFile(store, kind, identity);
    try {
      const entry = JSON.parse(
        fs.readFileSync(file, "utf8"),
      ) as Partial<IEntry>;
      if (
        entry.format !== FORMAT ||
        entry.version !== store.version ||
        entry.kind !== kind ||
        !Object.prototype.hasOwnProperty.call(entry, "value")
      )
        return undefined;
      recordCacheFileUse(file);
      E2ETrace.capabilityResolution("plugin-load-answer", {
        kind,
        outcome: "reused",
      });
      return entry.value;
    } catch {
      return undefined;
    }
  }

  /**
   * Record `value` as the answer for `identity`. Failures are ignored: the
   * answer just computed stands, and the next process computes it again.
   *
   * @param store The opened store, or `undefined` for no persistence.
   * @param kind Answer family.
   * @param identity Every input identity the answer depends on.
   * @param value JSON-serializable answer the caller proved for `identity`.
   * @evidence contracts/common.md#principled-implementation Publication happens only when the caller decided the computation was proven; the entry records the same identity framing that read checks.
   * @evidence contracts/common.md#clear-and-simple-design One atomic publication through the shared metadata writer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed write never fails the load or fabricates an entry.
   * @evidence contracts/common.md#meaningful-documentation Native prose states failure behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Same-directory staging and rename through the shared writer.
   * @evidence contracts/performance.md#efficient-algorithms Serializes the identity and value once and writes one small file.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Publication creates the reusable entry; read owns reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One file per identity, removed by the single-file collector or `ttsc clean`; staging cleanup belongs to the shared writer.
   */
  export function write(
    store: PluginContentIdentities.Store | undefined,
    kind: string,
    identity: unknown,
    value: unknown,
  ): void {
    if (store === undefined) return;
    const file = answerFile(store, kind, identity);
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      SourceBuildCacheLayout.replaceCacheMetadataFile(
        file,
        JSON.stringify({
          format: FORMAT,
          version: store.version,
          kind,
          value,
        } satisfies IEntry),
      );
      E2ETrace.capabilityResolution("plugin-load-answer", {
        kind,
        outcome: "recorded",
      });
    } catch {
      // The answer just computed stands; only its reuse is lost.
    }
  }

  /** Entry format tag; move it when the entry shape changes. */
  const FORMAT = "ttsc-plugin-load-answer-v1";

  interface IEntry {
    format: string;
    version: string;
    kind: string;
    value: unknown;
  }

  function answerFile(
    store: PluginContentIdentities.Store,
    kind: string,
    identity: unknown,
  ): string {
    const key = crypto
      .createHash("sha256")
      .update(JSON.stringify([FORMAT, store.version, kind, identity]))
      .digest("hex");
    return path.join(
      store.root,
      SourceBuildCacheLayout.ANSWER_CACHE_DIRNAME,
      `${key}.json`,
    );
  }
}
