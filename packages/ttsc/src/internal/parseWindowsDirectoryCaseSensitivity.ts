/**
 * Interpret fsutil's case-sensitivity query without assuming a display
 * language.
 *
 * English messages identify the state in the final field of the complete
 * native message. The echoed directory path supplies no status evidence. For
 * every other locale, the volume-root query supplies the raw localized suffix
 * for the ordinary disabled state. A target with that suffix is insensitive;
 * a different successful message is the enabled state.
 *
 * Inputs must be successful fsutil query responses. The opaque comparison
 * assumes the volume-root response represents the ordinary disabled state;
 * unrecognized or truncated framing returns no answer.
 *
 * @evidence contracts/common.md#principled-implementation Capturing the final status field of the complete native English message separates status authority from echoed path data. Other locales compare the successful response suffix with a known disabled volume-root response, under the query framing and root-state premises.
 * @evidence contracts/common.md#clear-and-simple-design One complete-message recognition precedes one raw-byte fallback, avoiding a separate locale dictionary or unreliable console-code-page conversion.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The native English message grammar supplies status framing without path-word exceptions or a locale dictionary. Absent baseline framing remains undefined, while the successful-query premise is explicit rather than applied to arbitrary output.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe locale handling, successful-query inputs and the disabled-root assumption, with the acknowledgment block separated.
 * @evidence contracts/portability.md#os-neutral-implementation Windows-specific query interpretation remains isolated; comparing native output bytes avoids assuming UTF-8 decoding preserves localized fsutil suffixes, while volume-root framing remains a stated boundary assumption.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Decoded text, encoded root bytes and views of the supplied buffers are invocation-local; returning a boolean or undefined retains none of them and acquires no native handle or historical cache.
 * @evidence contracts/performance.md#efficient-algorithms UTF-8 decoding and trailing-whitespace trimming precede one anchored native-message scan. The fallback encodes the root, searches the volume buffer for those bytes and compares one suffix view. Work and temporary storage depend on response/root lengths and byte-search implementation; inputs have no size cap here, and no locale dictionary or recursive lookup is built.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This byte interpreter owns no native-query producer or mutable directory observations to coordinate. The caller supplies current query bytes and any reusable disabled-root baseline; the parser adds no authority cache.
 */
export function parseWindowsDirectoryCaseSensitivity(
  directoryOutput: Buffer,
  volumeOutput: Buffer | undefined,
  volumeRoot: string,
): boolean | undefined {
  const text = directoryOutput.toString("utf8");
  const english =
    /^Case sensitive attribute on directory [^\r\n]+ is (enabled|disabled)\.$/iu.exec(
      text.trimEnd(),
    );
  if (english !== null) return english[1]!.toLowerCase() === "enabled";
  if (volumeOutput === undefined) return undefined;

  const encodedRoot = Buffer.from(volumeRoot, "utf8");
  const rootOffset = volumeOutput.lastIndexOf(encodedRoot);
  if (rootOffset === -1) return undefined;
  const disabledSuffix = volumeOutput.subarray(rootOffset + encodedRoot.length);
  if (
    disabledSuffix.length === 0 ||
    directoryOutput.length < disabledSuffix.length
  ) {
    return undefined;
  }
  return !directoryOutput
    .subarray(directoryOutput.length - disabledSuffix.length)
    .equals(disabledSuffix);
}
