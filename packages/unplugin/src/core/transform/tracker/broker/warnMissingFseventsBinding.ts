/** Whether this process already warned. */
let warned = false;

/**
 * Tell the user, once per process, that macOS notifications are off because the
 * `fsevents` binding is not installed (samchon/ttsc#1425).
 *
 * The watch broker watches macOS through that binding, since `fs.watch` there
 * can lose events without notice. Without it, every macOS registration is
 * reported failed, so each delivery validates its inputs against the disk
 * instead of trusting silence: correct, but slower. The binding is an optional
 * dependency that package managers install on macOS unless told to omit
 * optional dependencies, so the cause is named with its remedy, as a Node
 * process warning, code `TTSC_FSEVENTS_MISSING`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A process warning explains an actual optional dependency failure and the
 *   resulting disk validation; it does not change watcher proof state.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One module-local bit deduplicates this diagnostic; binding resolution and
 *   backend failure remain with their respective owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The stable warning code identifies the real remediation path, without
 *   monkey-patching optional module loading or pretending a fallback is equivalent.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain cause, authority consequence and remedy under
 *   the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral host code receives this explicit macOS capability diagnostic;
 *   missing native support falls back to validation rather than unsafe silence.
 */
export function warnMissingFseventsBinding(): void {
  if (warned) return;
  warned = true;
  process.emitWarning(
    "@ttsc/unplugin: the optional dependency `fsevents` is not installed, so " +
      "macOS file notifications cannot be trusted and every delivery " +
      "validates its inputs against the disk instead. Install dependencies " +
      "without omitting optional ones to restore them.",
    { code: "TTSC_FSEVENTS_MISSING" },
  );
}
