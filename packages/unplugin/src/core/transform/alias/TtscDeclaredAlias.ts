/**
 * One alias entry as the host declared it, before anything decides whether a
 * tsconfig `paths` map can express it.
 *
 * Both of Vite's spellings reach here, the `{ "@": "/src" }` object and the `{
 * find, replacement }` array, and only Vite's: `aliases` is populated in
 * `vite.configResolved` alone, and every other adapter passes `undefined`. (The
 * previous wording credited the object form to webpack and Rspack, which never
 * supply one.)
 *
 * `find` is `unknown` rather than `string` because Vite's array form accepts a
 * `RegExp`, and narrowing it here is what used to drop that form before the one
 * place that could report the drop ever saw it (samchon/ttsc#1315).
 */
export interface TtscDeclaredAlias {
  /** The alias key, as declared: a module specifier prefix, or a `RegExp`. */
  find: unknown;
  /** Absolute or cwd-relative path that the alias points to. */
  replacement: string;
}
