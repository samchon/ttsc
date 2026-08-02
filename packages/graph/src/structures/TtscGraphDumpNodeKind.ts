/** Declaration kinds the native Go dump producer can write. */
export type TtscGraphDumpNodeKind =
  | "module"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "method";
