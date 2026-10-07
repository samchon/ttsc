/**
 * What a graph node represents.
 *
 * The native builder emits declaration kinds from `module` through `method`.
 * The TypeScript memory layer replaces each module with a `file` container and
 * refines class/interface member variables to `property`. An external boundary
 * leaf keeps its real declaration kind and sets `external: true`.
 *
 * Used as the `kind` discriminant on {@link ITtscGraphNode}.
 *
 * @evidence contracts/common.md#principled-implementation Literal variants distinguish memory-layer declaration containers, refined members and published artifacts.
 * @evidence contracts/common.md#clear-and-simple-design A single kind union is shared by node records instead of independent untyped classification strings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Kinds express supported graph semantics, not fixture names or framework-specific categories.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain native-to-memory refinement and external leaves before the tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export type TtscGraphNodeKind =
  | "file"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "method"
  | "property"
  | "markdown_document"
  | "markdown_section"
  | "prisma_model"
  | "prisma_column"
  | "prisma_relation"
  | "swagger_operation";
