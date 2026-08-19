import type { ITtscEvidenceGraphReference } from "./ITtscEvidenceGraphReference";

/**
 * What every claim declares: which artifact kind makes the claim, where its
 * population lives, and which evidence it must cite completely.
 *
 * A claim owns the outgoing side of every evidence edge it declares. The
 * properties here are the ones that mean the same thing in Markdown, Prisma,
 * and TypeScript; only the symbol selector differs, because its eligible host
 * kinds are a property of the language rather than of the claim.
 *
 * Swagger is deliberately absent. An API operation grounds a claim but cannot
 * host `@evidence`, so it extends {@link ITtscEvidenceGraphReferenceBase}
 * instead and never this one.
 */
export interface ITtscEvidenceGraphClaimBase<Type extends string> {
  /** Identifies the artifact kind making this claim. */
  type: Type;

  /**
   * Optional human-readable label shown with diagnostics for this claim. It
   * does not identify evidence nodes or establish relationships between
   * configuration entries.
   */
  name?: string;

  /**
   * Excludes this claim from graph loading and evaluation.
   *
   * The configuration shape is still validated, but this claim contributes no
   * populations, references, coverage obligations, completion hints, or watched
   * inputs. Omit this property or set it to `false` to enable the claim.
   *
   * @default false
   */
  disabled?: boolean;

  /**
   * Directory this claim's {@link files} patterns resolve against.
   *
   * Omit this property to resolve against the active `ttsc` project root, which
   * is where every population resolved before this property existed.
   *
   * The value names one directory, never a glob. It may sit inside the project,
   * above it (`../../docs`), or on an absolute path. A drive-relative Windows
   * path such as `C:docs` is refused, because it resolves against whatever
   * directory that drive currently sits on rather than against a stable base.
   *
   * A diagnostic that asks you to correct this property quotes the spelling you
   * declared, while the file locations beside it stay project-relative. The
   * resolved patterns are published to the `ttsc` host as watched inputs.
   */
  root?: string;

  /**
   * Glob patterns for the files that must cite the referenced evidence,
   * resolved against {@link root} or against the project root when none is
   * declared.
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
   * A bare directory such as `src` or `src/` does not include its children;
   * write `src/**` when the whole subtree belongs to this claim.
   */
  files: string[];

  /**
   * Glob patterns for the files that may host this claim's `@evidenceExclude`
   * declarations.
   *
   * Omit this property to accept an exclusion wherever it is otherwise
   * eligible, which is how every claim behaved before this property existed.
   *
   * Declare it to gather them. An exclusion is the one acknowledgement that
   * reports an obligation discharged without anything being built, so reading
   * every exclusion a claim owns is a review that has to happen; scattered
   * through the population it means reading the population, and named here it
   * means opening these files. An exclusion selected from any other file is
   * reported where it sits, naming these patterns, and discharges nothing, so
   * its target still owes positive `@evidence`.
   *
   * The patterns narrow and never widen. They use the grammar and the root
   * {@link files} uses, and a carrier must already be selected by {@link files}
   * to host anything.
   *
   * This is independent of `noEvidenceExclude`, which decides whether one
   * reference accepts an exclusion at all. A claim whose every reference
   * refuses them gains nothing here.
   *
   * A `checklist` reference is refused beside these globs. That option makes
   * every acknowledgement one host's own answer, so confining exclusions to
   * other files would leave every host outside them unable to record that an
   * item does not apply. A checklist reference that also declares
   * `noEvidenceExclude` accepts no exclusion to gather and is allowed.
   */
  evidenceExcludeCarriers?: string[];

  /**
   * One evidence population or independently complete evidence populations that
   * this claim must cite.
   *
   * A single reference requires this claim's files to acknowledge every
   * evidence unit it materializes. An array creates a separate 100% obligation
   * for every element: acknowledgements toward one reference never count toward
   * another, and partially covered references cannot be pooled. The array must
   * not be empty.
   */
  reference: ITtscEvidenceGraphReference | ITtscEvidenceGraphReference[];
}
