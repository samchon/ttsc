/**
 * A verdict about one generation that later deliveries replay instead of
 * repeating the whole compile behind it.
 *
 * The two kinds are replayed on different evidence, and each carries its own: a
 * pass verdict knows the pass it belongs to, and an unstable generation knows
 * the recorded environment it was proven against.
 */
export abstract class TtscTerminalGenerationError extends Error {}
