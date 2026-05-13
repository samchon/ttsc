import type { ITtscPlugin } from "./structures/ITtscPlugin";

/**
 * Identity helper for authoring `ITtscPlugin` descriptors with full literal
 * type preservation.
 *
 * Two call shapes:
 *
 * - Object form: returns the descriptor unchanged but pins its narrowed type so
 *   editor tooling and `satisfies` clauses can see exact field values.
 * - Factory form: wraps a `(context) => descriptor` factory so the returned
 *   function carries the literal descriptor type through to consumers without
 *   forcing a manual `as const`.
 *
 * Pure pass-through at runtime — the function exists to teach TypeScript the
 * const-narrowing the user would otherwise have to spell out.
 */
export function defineTtscPlugin<const T extends ITtscPlugin>(plugin: T): T;
export function defineTtscPlugin<TContext, const T extends ITtscPlugin>(
  factory: (context: TContext) => T,
): (context: TContext) => T;
export function defineTtscPlugin(
  value: ITtscPlugin | ((context: unknown) => ITtscPlugin),
): ITtscPlugin | ((context: unknown) => ITtscPlugin) {
  return value;
}
