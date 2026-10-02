/**
 * A verdict about one generation that later deliveries replay instead of
 * repeating the whole compile behind it.
 *
 * The two kinds are replayed on different evidence, and each carries its own: a
 * pass verdict knows the pass it belongs to, and an unstable generation knows
 * the recorded environment it was proven against.
 *
 * @evidence contracts/common.md#principled-implementation The abstract Error subclass groups replayable generation verdicts while concrete subclasses retain the distinct pass or environment premises authorizing replay.
 * @evidence contracts/common.md#clear-and-simple-design An empty abstract base supplies shared typed classification without duplicating fields whose meanings differ between verdicts.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Grouping does not authorize unconditional reuse; concrete verdict evidence remains required by the consuming cache policy.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs distinguish the two replay premises and explain why each concrete type owns its own evidence.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   An error class that carries a message and fields only; it touches no
 *   filesystem, path or process.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The constructor assigns its fields; constant work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Computes nothing that could be reused.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Retains only the message, cause and fields given to the constructor,
 *   released with the error.
 */
export abstract class TtscTerminalGenerationError extends Error {}
