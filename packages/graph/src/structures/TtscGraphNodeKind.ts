/**
 * What a graph node represents.
 *
 * The native builder emits declaration kinds from `module` through `method`.
 * The TypeScript memory layer replaces each module with a `file` container and
 * refines class/interface member variables to `property`. An external boundary
 * leaf keeps its real declaration kind and sets `external: true`.
 *
 * Used as the `kind` discriminant on {@link ITtscGraphNode}.
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
  | "property";
