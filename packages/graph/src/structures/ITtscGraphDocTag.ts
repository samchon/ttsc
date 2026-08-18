/**
 * One documentation tag TypeScript itself does not recognize, written on a
 * declaration and carried on its {@link ITtscGraphNode}'s `docTags`.
 *
 * A convention attaches a declaration to something outside the type system — a
 * specification section, an API operation, a reference document — and writes
 * that attachment as a tag, because the thing on the other end is not a
 * TypeScript declaration and so cannot be an edge. `@evidence
 * docs/pricing.md#sale`, `@reference https://…`, and a project's own `@spec`
 * are one fact in three spellings.
 *
 * Reported faithfully, never interpreted. The graph does not say a tag's text
 * resolves to anything, is covered, or is true — a target naming nothing is
 * carried exactly as written, the way {@link ITtscGraphDecorator} carries
 * `@Controller` without knowing what a controller is.
 *
 * Which tags arrive is the compiler's boundary, not a list kept here: these are
 * the tags the parser had no meaning for. A known tag — `@param`, `@returns`,
 * `@deprecated` — has its own shape and its own meaning and is not one of
 * these.
 *
 * The parser also decides where a tag begins, and that decision is reported
 * rather than second-guessed. TypeScript opens a tag at an `@` wherever it sits
 * inside a documentation block, so a tag name written mid-sentence arrives here
 * as a tag, while a `//` comment is not documentation and contributes nothing at
 * all. A convention that wants the stricter rule enforces it in its own linter,
 * where the author gets a diagnostic; the graph reports what the compiler
 * parsed.
 */
export interface ITtscGraphDocTag {
  /** The tag name without its `@`: `evidence`, `evidenceExclude`, `reference`. */
  name: string;

  /**
   * Everything written after the tag name, joined into one line.
   *
   * An inline link keeps the braced form it was written in (`{@link ISale}`),
   * so a consumer matching a citation target sees what the author typed. The
   * same link is separately a resolved edge on the node, which is what says
   * *which* `ISale` — a name can be declared twice and only the checker knows.
   *
   * Absent when the tag carries no text.
   */
  text?: string;
}
