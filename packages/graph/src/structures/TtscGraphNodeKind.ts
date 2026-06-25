/**
 * What a graph node represents.
 *
 * The symbol kinds (`file` through `parameter`) are declarations the TypeScript
 * program owns and the checker resolves. `external_symbol` is a
 * dependency-boundary leaf the workspace references but does not declare — the
 * graph keeps it as a named endpoint without expanding the dependency's
 * internals.
 *
 * Used as the `kind` discriminant on {@link ITtscGraphNode}.
 */
export type TtscGraphNodeKind =
  | "file"
  | "package"
  | "namespace"
  | "module"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "method"
  | "property"
  | "parameter"
  | "external_symbol";
