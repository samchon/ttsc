/**
 * Interpret fsutil's case-sensitivity query without assuming a display
 * language.
 *
 * English messages identify the state directly. For every other locale, the
 * volume-root query supplies the raw localized suffix for the ordinary disabled
 * state. A target with that suffix is insensitive; a different successful
 * message is the enabled state.
 */
export function parseWindowsDirectoryCaseSensitivity(
  directoryOutput: Buffer,
  volumeOutput: Buffer | undefined,
  volumeRoot: string,
): boolean | undefined {
  const text = directoryOutput.toString("utf8");
  if (/\bdisabled\b/iu.test(text)) return false;
  if (/\benabled\b/iu.test(text)) return true;
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
