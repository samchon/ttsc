import type { TtscEvidenceGraphTypeScriptSymbol } from "../typings/TtscEvidenceGraphTypeScriptSymbol";
import type { ITtscEvidenceGraphReferenceBase } from "./ITtscEvidenceGraphReferenceBase";

/**
 * A population of TypeScript evidence that the owning claim must cite.
 *
 * An exported symbol expresses a contract that a program can check
 * mechanically. Treating selected symbols as graph nodes lets a claim point to
 * a named type, callable, or property instead of citing a file as
 * undifferentiated implementation.
 *
 * The selection keeps the evidence graph deliberate. It can cover public types
 * by default, then opt into functions or properties only where their individual
 * contracts deserve documentary proof.
 */
export interface ITtscEvidenceGraphTypeScriptReference extends ITtscEvidenceGraphReferenceBase<"typescript"> {
  /**
   * Installed package whose declarations form this population.
   *
   * Omit it to select the active project. When present, {@link files} resolves
   * against the package root instead of the project root, so the globs read as
   * a consumer thinks of the package rather than carrying its `node_modules`
   * location.
   *
   * A package population is read from disk rather than from the `ttsc` program.
   * That is the point: a symbol nothing imports is absent from the program by
   * definition, and it is exactly the symbol an obligation needs to name.
   *
   * Without {@link files}, the package's own declaration entry is the
   * population, and every symbol reachable from it is a candidate unit
   * addressed by its accessor path from that entry — which is what makes
   * `api.functional.questions.get` nameable. The entry is read from the `types`
   * condition of the `exports` map, then `typesVersions`, then the `types` or
   * `typings` field — never `main`, which names the JavaScript a consumer runs
   * rather than the declarations a citation can address.
   */
  package?: string;

  /**
   * Project-relative glob patterns for candidate TypeScript files in the active
   * `ttsc` project. A matching file outside the project's `tsconfig` program is
   * not available to the rule and does not count as a match.
   *
   * When {@link package} is set these are package-relative instead, and the
   * files are read from disk rather than from the program.
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
   * For example, `src/**` selects the complete source subtree, while
   * `scripts/check-?.ts` selects `check-a.ts` but not `check-ab.ts`.
   *
   * A bare directory such as `src` or `src/` does not include its children;
   * write `src/**` when the whole subtree belongs to this reference.
   *
   * Required for a local reference; there is no implicit project population.
   * Only a {@link package} reference may omit it, and then the package's
   * declaration entry defines the population instead.
   */
  files?: string[];

  /**
   * Symbol kind or kinds eligible to become evidence units.
   *
   * Omit this property to select exported interfaces, type aliases, classes,
   * and namespaces. A single value selects one obligation kind; a non-empty
   * array selects the union. Selected units remain independent obligations
   * until an ancestor type or namespace target acknowledges their shared scope.
   * Ancestors of selected units are addressable even when their own kind is
   * omitted from this selector.
   *
   * The exact declaration forms and qualified target identities are documented
   * by {@link TtscEvidenceGraphTypeScriptSymbol}. This is unlike a claim's
   * `symbol`, which selects declaration hosts: a reference's symbol array
   * expands the evidence units one obligation covers.
   *
   * @default type
   */
  symbol?:
    | TtscEvidenceGraphTypeScriptSymbol
    | TtscEvidenceGraphTypeScriptSymbol[];
}
