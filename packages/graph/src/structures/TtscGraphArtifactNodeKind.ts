import type { TtscGraphNodeKind } from "./TtscGraphNodeKind";

/**
 * The node kinds that are published artifacts rather than TypeScript
 * declarations.
 *
 * A citation whose target is a TypeScript symbol is a relation the checker
 * resolved. A citation whose target is a document section, a data model field,
 * or an API operation is one of these: a plugin parsed the artifact and
 * published what it is, and the graph indexes that without interpreting any of
 * it. What the linter decided about the citation — covered, excluded, missing —
 * never travels; that is its product and it delivers it as a compile error.
 */
export const TTSC_GRAPH_ARTIFACT_NODE_KINDS = [
  "markdown_document",
  "markdown_section",
  "prisma_model",
  "prisma_column",
  "prisma_relation",
  "swagger_operation",
] as const satisfies readonly TtscGraphNodeKind[];

/**
 * Whether a node kind names a published artifact.
 *
 * It is the gate an id parser needs. An artifact's id is the address a citation
 * writes — `docs/sale.md#pricing`, `prisma:Sale.price`, `POST:/orders` — and
 * none of those follow the `path#qualifiedName:kind` grammar
 * {@link TtscGraphNodeId} assumes: a Prisma address carries no path because a
 * model name is unique across the schema folder, and an operation has no file
 * at all.
 */
export function isArtifactNodeKind(kind: string): boolean {
  return (TTSC_GRAPH_ARTIFACT_NODE_KINDS as readonly string[]).includes(kind);
}
