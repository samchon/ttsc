/** Relationship kinds the native Go dump producer can write. */
export type TtscGraphDumpEdgeKind =
  | "exports"
  | "calls"
  | "accesses"
  | "instantiates"
  | "type_ref"
  | "extends"
  | "implements"
  | "overrides"
  | "renders";
