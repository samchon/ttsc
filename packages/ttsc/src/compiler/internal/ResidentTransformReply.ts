import type { ResidentReplyKind } from "./ResidentReplyKind";

/**
 * Decode resident reply objects and validate their operation-specific fields.
 *
 * Parsing distinguishes malformed JSON or a non-object value from an object
 * with the wrong reply shape. The transport owns how either failure settles its
 * FIFO; these operations do not read pipes or manage a resident child.
 *
 * @evidence contracts/common.md#principled-implementation Separate object decoding and operation admission preserve the distinction the transport uses for framing failure versus one invalid reply.
 * @evidence contracts/common.md#clear-and-simple-design One internal namespace owns the two reply-data operations used by the resident transport without acquiring its queue or process state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The decoder and predicate retain ordinary JSON and field checks; no synthetic reply, foreign mutation or alternate host is introduced.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs identify the failure distinction and leave FIFO settlement and child lifetime with the transport.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This namespace groups JSON data operations and defines no native file, path or process boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace container performs no computation; its members own decoding and field checks.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace stores no completed or in-flight results and coordinates no shared request work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace holds no mutable state, handles or running tasks.
 */
export namespace ResidentTransformReply {
  /**
   * Parse one JSON object, returning `undefined` for malformed JSON, arrays,
   * primitives and `null`. An empty object remains an object for the separate
   * operation-shape check; corrupt data never becomes a synthetic empty reply.
   *
   * @evidence contracts/common.md#principled-implementation JSON.parse owns JSON syntax and values; the nonnull object and nonarray checks admit only decoded object records.
   * @evidence contracts/common.md#clear-and-simple-design One parse attempt followed by object admission leaves reply fields and transport settlement to their owning operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Parse failure remains undefined rather than being repaired or replaced with a successful negative reply.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph distinguishes malformed data from the empty object passed to shape validation.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation JSON text and decoded values are data; this operation accesses no filesystem or process.
   * @evidence contracts/performance.md#efficient-algorithms The native JSON decoder scans the supplied text and allocates its decoded value; object admission uses fixed checks without a second traversal. Input text and decoded population determine time and temporary space.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call decodes its supplied reply; this operation coordinates no completed or in-flight work across requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned record transfers to the caller; this operation retains no historical values, handles or tasks and sets no input-size bound.
   */
  export function parse(line: string): Record<string, unknown> | undefined {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return undefined;
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  }

  /**
   * Admit a decoded object for the operation the caller requested.
   *
   * Transform replies need boolean `found`; a found file also needs string
   * `typescript`, including empty text. A missing file leaves text irrelevant.
   * Update replies need boolean `updated`. Extra fields are allowed.
   *
   * @evidence contracts/common.md#principled-implementation The requested operation selects its required boolean field, and only a found transform requires text, preserving legitimate negative replies.
   * @evidence contracts/common.md#clear-and-simple-design Fixed field checks consume the parsed record and operation discriminant without copying payloads or consulting transport state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing and rejected outcomes remain valid booleans; wrong field types are rejected rather than coerced or inferred from unrelated fields.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph explains empty text, negative replies and permitted extra fields without claiming FIFO or lifecycle coverage.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The operation inspects decoded fields without interpreting filenames or accessing native resources.
   * @evidence contracts/performance.md#efficient-algorithms Admission performs a fixed number of property reads and type checks on ordinary JSON-decoded records, independent of text or extra-field count. Supplying a different accessor-bearing record can add caller-defined property-read work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The predicate coordinates no cross-request computation or cached admission result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Field checks retain no reply, callback, handle or running task after return.
   */
  export function isValid(
    reply: Record<string, unknown>,
    kind: ResidentReplyKind,
  ): boolean {
    if (kind === "transform") {
      if (typeof reply.found !== "boolean") {
        return false;
      }
      return reply.found ? typeof reply.typescript === "string" : true;
    }
    return typeof reply.updated === "boolean";
  }
}
