/** Whether this loaded module copy already requested its warning. */
let warned = false;

/**
 * Request one warning for this loaded adapter copy when its macOS broker cannot
 * resolve the optional `fsevents` binding.
 *
 * The watch broker watches macOS through that binding, since `fs.watch` there
 * can lose events without notice. Missing resolution makes broker registrations
 * fail rather than authorizing silence; custom watchers are separate. The
 * binding is an optional
 * dependency that package managers install on macOS unless told to omit
 * optional dependencies, so the cause is named with its remedy, as a Node
 * process warning, code `TTSC_FSEVENTS_MISSING`. Resolution failure need not mean
 * the package was never installed, and actual child loading is checked later.
 * The flag is set before emission and is not reset; host warning listeners and
 * display policy own delivery, not this operation.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A stable process warning names failed optional binding resolution without
 *   claiming installation absence was proven; watcher proof/fallback remains
 *   with broker and validator owners.
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
 * @evidence contracts/performance.md#bound-retention-and-release-resources One module-local bit retains completed emission admission for that copy's lifetime, with no reset/history population. Node owns warning construction, later dispatch and host listener/output retention; this function acquires no descriptor or watcher and does not guarantee display completion.
 * @evidence contracts/performance.md#efficient-algorithms A fixed bit guards at most one emission call per loaded copy. Warning Error/stack construction and host dispatch/output work remain delegated costs; the one-call count is not a fixed IO/handler-duration guarantee.
 * @evidence contracts/performance.md#reuse-equivalent-work The flag prevents repeated warning requests from this loaded copy, not repeated binding resolution or native loading. Different module copies have independent flags, and warning suppression/display behavior is host-owned; no retry occurs after the flag is set.
 */
export function warnMissingFseventsBinding(): void {
  if (warned) return;
  warned = true;
  process.emitWarning(
    "@ttsc/unplugin: the optional dependency `fsevents` could not be resolved, so " +
      "macOS file notifications cannot be trusted and every delivery " +
      "validates its inputs against the disk instead. Check that optional " +
      "dependencies are installed and that `fsevents` resolves from this package.",
    { code: "TTSC_FSEVENTS_MISSING" },
  );
}
