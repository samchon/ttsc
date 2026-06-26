/**
 * A declaration modifier carried on a symbol {@link ITtscGraphNode}, when the
 * declaration pass records it. Used by projections that reason about visibility
 * and shape — e.g. a public-API overview filters on `export`, a class outline
 * separates `static` members.
 */
export type TtscGraphNodeModifier =
  | "export"
  | "default"
  | "declare"
  | "abstract"
  | "static"
  | "readonly"
  | "async"
  | "const"
  | "public"
  | "private"
  | "protected"
  | "optional";
