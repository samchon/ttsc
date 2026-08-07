import type { TtscEvidenceGraphMarkdownSymbol } from "../typings/TtscEvidenceGraphMarkdownSymbol";
import type { ITtscEvidenceGraphReferenceBase } from "./ITtscEvidenceGraphReferenceBase";

/**
 * A population of documentary evidence that the owning claim must cite.
 *
 * A document is useful as evidence only when a reviewer can identify the scope
 * that supports a claim. This reference makes the obligation levels explicit
 * while allowing one file or heading target to acknowledge its selected
 * descendants. Citations remain anchored in the outline, so an editorial change
 * cannot silently preserve a claim whose grounds disappeared.
 */
export interface ITtscEvidenceGraphMarkdownReference extends ITtscEvidenceGraphReferenceBase<"markdown"> {
  /**
   * Directory this population's {@link files} patterns resolve against, and the
   * base its evidence targets are addressed from.
   *
   * Omit this property to resolve against the active `ttsc` project root, which
   * is where every population resolved before this property existed.
   *
   * The value names one directory, never a glob. It may sit inside the project
   * (`docs`), above it (`../../docs`), or on an absolute path
   * (`/srv/contracts`, `C:/contracts`). A drive-relative Windows path such as
   * `C:docs` is refused, because it resolves against whatever directory that
   * drive currently sits on rather than against a stable base.
   *
   * Moving the root moves the addresses with it. With `root: "../../docs"` and
   * `files: ["requirements/**"]`, a section is cited as
   * `requirements/pricing.md#discounts` rather than through this project's
   * distance from the documents — which is what lets two packages sharing one
   * requirements set write the same citation, and why a shared population
   * declares its root once instead of spelling `..` inside every pattern.
   *
   * Diagnostics name the resolved base, and the resolved patterns are published
   * to the `ttsc` host as watched inputs, so editing a document above the
   * project still invalidates the graph.
   */
  root?: string;

  /**
   * Glob patterns for Markdown documents in this evidence population, resolved
   * against {@link root} or against the project root when none is declared.
   * Every matching regular file is parsed as Markdown regardless of extension,
   * so exclude images and other non-Markdown assets from the patterns.
   *
   * These are globs, not regular expressions. `*` matches within one path
   * segment, `**` crosses any number of path segments, and `?` matches one
   * character. Both `/` and `\` are accepted as separators, while path identity
   * remains case-sensitive on every operating system.
   *
   * Patterns are evaluated from left to right. A pattern prefixed with `!`
   * removes its matches; a later positive pattern can include them again. The
   * array must contain at least one positive pattern.
   *
   * For example, `docs/*.md` selects Markdown files directly under `docs`,
   * while `specs/v?.md` selects names such as `v1.md` but not `v10.md`.
   *
   * A bare directory such as `docs` or `docs/` does not include its children;
   * write `docs/**` when the whole subtree belongs to this reference.
   */
  files: string[];

  /**
   * Markdown node kind or kinds eligible to become evidence units.
   *
   * Omit this property to select documents and H1 through H4 sections. A single
   * value selects one obligation kind; a non-empty array selects the union.
   * Selected units remain independent obligations until an ancestor target
   * acknowledges their shared scope. Ancestors of selected units are
   * addressable even when their own kind is omitted from this selector.
   *
   * File units use the path inside {@link root} as their target. Heading units
   * use `<path>#<anchor>` as documented by
   * {@link TtscEvidenceGraphMarkdownSymbol}.
   *
   * @default ["file", "h1", "h2", "h3", "h4"]
   */
  symbol?: TtscEvidenceGraphMarkdownSymbol | TtscEvidenceGraphMarkdownSymbol[];
}
