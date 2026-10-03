/**
 * Text handling shared by the strict JSON and the JSONC config readers.
 *
 * Both readers must report a failure the same way, and both accept a leading
 * byte-order mark, or a `package.json` and a `tsconfig.json` saved by the same
 * editor would be accepted by one reader and rejected by the other. The JSONC
 * reader counts a byte-order mark as whitespace at trivia positions, as the compiler does,
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
   * @evidence contracts/performance.md#efficient-algorithms One Error test selects a message property or JavaScript String conversion. Primitive conversion cost follows the rendered value; a custom property or conversion can run user behavior or throw, so fixed local expressions do not bound arbitrary thrown-value formatting work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This formatter coordinates no work across requests and retains no result history; it describes the current supplied failure.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation describe computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
   */
  export function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Replace a leading UTF-8 BOM with a space. JSON ignores leading whitespace,
   * so blanking rather than removing keeps every later offset equal to the
   * offset in the original file. Later U+FEFF characters are left in place:
   * strict JSON rejects them as outside-string whitespace, while quoted string
   * data can contain them.
   *
   * @evidence contracts/common.md#principled-implementation Replacing exactly one leading U+FEFF with whitespace preserves later UTF-16 offsets while JSON.parse accepts the replacement; later characters retain strict JSON's distinction between valid string data and invalid outside-string whitespace.
   * @evidence contracts/common.md#clear-and-simple-design One prefix adapter supplies strict-JSON compatibility without duplicating the JSONC reader's broader compiler whitespace grammar.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts U+FEFF is the declared encoding marker, not an expected-output special case; arbitrary nonleading characters are not erased to force acceptance.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph explains length-preserving replacement and the later-character string-versus-whitespace distinction, following the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources stripLeadingBom acquires no handle, buffer or cache and retains nothing after it returns.
   * @evidence contracts/performance.md#efficient-algorithms One leading-code-unit test returns the unchanged string when no BOM is present; replacement slices the remaining text and constructs a same-length string. Work and local string storage can grow with text length rather than the fixed expression count, and no scan for later markers or parser duplication is performed.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This prefix adapter coordinates no cross-request work or retained cache; consumers normalize their current text before strict parsing.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation stripLeadingBom computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
   */
  export function stripLeadingBom(input: string): string {
    return input.charCodeAt(0) === 0xfeff ? ` ${input.slice(1)}` : input;
  }
}
