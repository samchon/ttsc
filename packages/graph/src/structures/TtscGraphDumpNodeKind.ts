/**
 * Node kinds the native Go dump producer can write.
 *
 * The last six are not declarations. A plugin materialized them from a Markdown
 * document, a Prisma schema, or an API document — artifacts a citation can name
 * that the type system holds nothing for — and their ids are the address a
 * citation writes rather than the `path#name:kind` grammar, which is why an id
 * is parsed only after its kind says it can be.
 *
 * @evidence contracts/common.md#principled-implementation Native declaration and published artifact variants match the wire producer vocabulary before memory refinement.
 * @evidence contracts/common.md#clear-and-simple-design The wire union is separate from memory kinds so module replacement does not weaken native validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Artifact addresses are not coerced into TypeScript symbol-id grammar.
 * @evidence contracts/common.md#meaningful-documentation Native documentation explains the artifact distinction and the gate required before parsing identities.
 */
export type TtscGraphDumpNodeKind =
  | "module"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "method"
  | "markdown_document"
  | "markdown_section"
  | "prisma_model"
  | "prisma_column"
  | "prisma_relation"
  | "swagger_operation";
