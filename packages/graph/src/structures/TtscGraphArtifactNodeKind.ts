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
 *
 * @evidence contracts/common.md#principled-implementation Membership in the declared artifact-kind vocabulary distinguishes non-TypeScript addresses before symbol-id parsing.
 * @evidence contracts/common.md#clear-and-simple-design The predicate shares the exported kind list instead of maintaining a second classification switch.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The check concerns semantic kinds, not heuristics about address punctuation or fixture paths.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why artifact identities cannot use the TypeScript id parser.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isArtifactNodeKind acquires no handle or task and retains nothing beyond its return value.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isArtifactNodeKind makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isArtifactNodeKind computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation isArtifactNodeKind operates on in-memory values and performs no filesystem, path or process operation.
 */
export function isArtifactNodeKind(kind: string): boolean {
  return (TTSC_GRAPH_ARTIFACT_NODE_KINDS as readonly string[]).includes(kind);
}
