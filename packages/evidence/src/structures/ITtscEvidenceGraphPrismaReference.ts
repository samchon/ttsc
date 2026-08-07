import type { TtscEvidenceGraphPrismaSymbol } from "../typings/TtscEvidenceGraphPrismaSymbol";
import type { ITtscEvidenceGraphReferenceBase } from "./ITtscEvidenceGraphReferenceBase";

/**
 * A population of Prisma schema declarations that the owning claim must cite.
 *
 * A data model is a set of decisions about what the product stores, and this
 * reference makes each of them something a claim has to answer for. A provider
 * cites the model it persists, a DTO cites the column it exposes, and a table
 * nothing cites becomes a build failure rather than a discovery made later.
 *
 * Every matched file is parsed together as one schema, because a Prisma schema
 * folder is a single namespace whose files reference each other. The parse is
 * Prisma's own, so a schema it rejects is reported as a parse failure rather
 * than as an empty population.
 */
export interface ITtscEvidenceGraphPrismaReference extends ITtscEvidenceGraphReferenceBase<"prisma"> {
  /**
   * Directory this population's {@link files} patterns resolve against.
   *
   * Omit this property to resolve against the active `ttsc` project root, which
   * is where every population resolved before this property existed.
   *
   * The value names one directory, never a glob. It may sit inside the project
   * (`prisma`), above it (`../../prisma`), or on an absolute path
   * (`/srv/schema`, `C:/schema`). A drive-relative Windows path such as
   * `C:prisma` is refused, because it resolves against whatever directory that
   * drive currently sits on rather than against a stable base.
   *
   * A Prisma target carries no path, so a declared root changes which files
   * belong to the schema set and where a diagnostic points, never how a model
   * is cited. Diagnostics name the resolved base, and the resolved patterns are
   * published to the `ttsc` host as watched inputs.
   */
  root?: string;

  /**
   * Glob patterns for the Prisma schema files in this evidence population,
   * resolved against {@link root} or against the project root when none is
   * declared. Every matching regular file is parsed as part of one schema
   * regardless of extension.
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
   * A bare directory such as `prisma` or `prisma/` does not include its
   * children; write `prisma/schema/**` when the whole folder belongs to this
   * reference.
   */
  files: string[];

  /**
   * Prisma node kind or kinds eligible to become evidence units.
   *
   * Omit this property to select models alone. A single value selects one
   * obligation kind; a non-empty array selects the union.
   *
   * The default is deliberately the coarsest one. Selecting every column puts
   * `id`, `created_at`, and every relation back-reference into the denominator,
   * which is a large obligation to discharge honestly and an easy one to
   * discharge with filler. Select `"column"` or `"relation"` when a claim
   * really does owe an answer per member, and use `@evidenceExclude` for the
   * members it deliberately does not use.
   *
   * A model remains addressable as an aggregate scope even when only its
   * members are selected, so one citation on the model can discharge all of
   * them.
   *
   * @default ["model"]
   */
  symbol?: TtscEvidenceGraphPrismaSymbol | TtscEvidenceGraphPrismaSymbol[];
}
