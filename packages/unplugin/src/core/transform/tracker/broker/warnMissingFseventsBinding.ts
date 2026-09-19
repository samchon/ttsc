/** Whether this process already warned. */
let warned = false;

/**
 * Tell the user, once per process, that macOS notifications are off because
 * the `fsevents` binding is not installed (samchon/ttsc#1425).
 *
 * The watch broker watches macOS through that binding, since `fs.watch` there
 * can lose events without notice. Without it, every macOS registration is
 * reported failed, so each delivery validates its inputs against the disk
 * instead of trusting silence: correct, but slower. The binding is an optional
 * dependency that package managers install on macOS unless told to omit
 * optional dependencies, so the cause is named with its remedy, as a Node
 * process warning, code `TTSC_FSEVENTS_MISSING`.
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
