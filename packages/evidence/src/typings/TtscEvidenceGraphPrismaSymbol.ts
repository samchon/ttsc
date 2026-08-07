/**
 * A Prisma schema node kind that can become an evidence unit or a selected host
 * for ownership evidence.
 *
 * `"model"` selects a declared model. `"column"` selects a stored field of one,
 * and `"relation"` selects a relation field. The split follows Prisma's own
 * resolution rather than the schema text: a relation has two sides, only one of
 * which usually carries `@relation`, and the back-reference carries no
 * attribute at all.
 *
 * A model contains its columns and relations, so an `@evidence` target or an
 * `@evidenceExclude` target allowed by its reference policy acknowledges every
 * selected member of it. A reference selector still defines which members are
 * obligations; a model whose own kind is omitted from the selector remains
 * addressable as their aggregate scope.
 *
 * Targets carry a `prisma:` prefix and are one whitespace-free token: a model
 * is `prisma:Sale`, and a member is `prisma:Sale.price`. The prefix is what
 * keeps a model named `Sale` from competing with a TypeScript type of the same
 * name, and the dot is unambiguous because a Prisma identifier is unicode
 * alphanumeric plus `_` and `-` and can never contain one.
 *
 * A model name is unique across the whole schema folder, so a target never
 * names the file a model is declared in and moving a model between files of one
 * schema cannot break a citation.
 *
 * A view is a `"model"` unit. That is Prisma's own shape rather than a choice
 * made here — its parser returns a view among the datamodel's models, with the
 * same fields and documentation a table has — so `prisma:SaleSummary` addresses
 * a view exactly as it addresses a table.
 *
 * Enums, composite types, indexes, and datasource or generator settings are
 * outside this contract. They materialize no unit and host no declaration. A
 * claim may separately accept `@evidenceExclude` in an unattached top-level
 * triple-slash run in a matching file; that carrier has no Prisma symbol and
 * never hosts `@evidence`.
 */
export type TtscEvidenceGraphPrismaSymbol = "model" | "column" | "relation";
