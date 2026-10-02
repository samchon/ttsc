/**
 * Text handling shared by the strict JSON and the JSONC config readers.
 *
 * Both readers must report a failure the same way, and both accept a leading
 * byte-order mark, or a `package.json` and a `tsconfig.json` saved by the same
 * editor would be accepted by one reader and rejected by the other. The JSONC
 * reader counts a byte-order mark as whitespace anywhere, as the compiler does,
 * so only the strict JSON reader needs {@link stripLeadingBom}.
 *
 * @evidence contracts/common.md#principled-implementation Shared error rendering and leading-BOM replacement express the two readers' common text concerns without claiming their distinct JSON and compiler JSONC grammars are interchangeable.
 * @evidence contracts/common.md#clear-and-simple-design The namespace groups two stateless text operations used by both file readers; parsing, root validation and filename attribution remain with their actual owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The grouping contains no parser replacement or fallback config values; it exposes only encoding-marker handling and actual failure text.
 * @evidence contracts/common.md#meaningful-documentation The namespace explains why readers share text handling and why JSONC does not need the strict reader's prefix operation, in paragraphs following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A namespace only groups the declarations inside it; each carries its own acknowledgments.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A namespace only groups the declarations inside it; each carries its own acknowledgments.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A namespace only groups the declarations inside it; each carries its own acknowledgments.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A namespace only groups the declarations inside it; each carries its own acknowledgments.
 */
export namespace ConfigJsonText {
  /**
   * Render a parse failure's message without the Error prefix.
   *
   * @evidence contracts/common.md#principled-implementation Native Error instances expose their message; other thrown values use JavaScript String conversion so attribution does not assume every failure is an Error object.
   * @evidence contracts/common.md#clear-and-simple-design This accessor owns only error-text extraction while the file reader supplies the filename and diagnostic context.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual thrown value supplies the text, with no fixture-specific diagnostic substitution or global Error mutation.
   * @evidence contracts/common.md#meaningful-documentation The native sentence states the useful formatting effect and keeps prose separate from acknowledgments following the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources describe acquires no handle, buffer or cache and retains nothing after it returns.
   * @evidenceExclude contracts/performance.md#efficient-algorithms describe performs a fixed number of steps with no loop or recursion over caller data.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work describe computes one result per call, so there is no repeated work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation describe computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
   */
  export function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Replace a leading UTF-8 BOM with a space. JSON ignores leading whitespace,
   * so blanking rather than removing keeps every later offset equal to the
   * offset in the original file. A BOM anywhere else is left in place and still
   * rejected.
   *
   * @evidence contracts/common.md#principled-implementation Replacing exactly one leading U+FEFF with whitespace preserves all later text offsets while JSON.parse accepts that leading whitespace; other BOM positions remain for strict JSON rejection.
   * @evidence contracts/common.md#clear-and-simple-design One prefix adapter supplies strict-JSON compatibility without duplicating the JSONC reader's broader compiler whitespace grammar.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts U+FEFF is the declared encoding marker, not an expected-output special case; arbitrary nonleading characters are not erased to force acceptance.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph explains why replacement preserves positions and which BOM positions remain invalid, following the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources stripLeadingBom acquires no handle, buffer or cache and retains nothing after it returns.
   * @evidenceExclude contracts/performance.md#efficient-algorithms stripLeadingBom performs a fixed number of steps with no loop or recursion over caller data.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work stripLeadingBom computes one result per call, so there is no repeated work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation stripLeadingBom computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
   */
  export function stripLeadingBom(input: string): string {
    return input.charCodeAt(0) === 0xfeff ? ` ${input.slice(1)}` : input;
  }
}
