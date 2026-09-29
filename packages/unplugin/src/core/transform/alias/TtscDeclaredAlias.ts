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
 *
 * @evidence contracts/common.md#principled-implementation The declared alias retains an unknown find value until translation can judge host regex versus string semantics; optional Vite root preserves root-relative replacement context.
 * @evidence contracts/common.md#clear-and-simple-design One normalized declaration shape represents both host object and array forms without mixing parsing with compiler-path translation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Regex aliases are not silently coerced into unsupported compiler patterns, and no other host is claimed to supply Vite's alias contract.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain form ownership, unknown find, and root-relative resolution; useful member comments retain the boundary reasons.
 */
export interface TtscDeclaredAlias {
  /** The alias key, as declared: a module specifier prefix, or a `RegExp`. */
  find: unknown;

  /** What the matched prefix is replaced with, as declared. */
  replacement: string;

  /**
   * The Vite root a replacement with a leading `/` is resolved against first,
   * as `vite:resolve` does. Absent for a caller that passes raw aliases, which
   * resolve against `process.cwd()`, Vite's own default root.
   */
  root?: string;
}
