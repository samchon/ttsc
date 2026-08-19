/**
 * Node kinds the native Go dump producer can write.
 *
 * The last six are not declarations. A plugin materialized them from a Markdown
 * document, a Prisma schema, or an API document — artifacts a citation can name
 * that the type system holds nothing for — and their ids are the address a
 * citation writes rather than the `path#name:kind` grammar, which is why an id
 * is parsed only after its kind says it can be.
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
