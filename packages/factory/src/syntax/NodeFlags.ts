/**
 * Flags for {@link factory.createVariableDeclarationList} and
 * {@link factory.createModuleDeclaration}.
 *
 * An outline of the relevant subset of the legacy `ts.NodeFlags`. Each member's
 * value is the keyword it implies (`Let = "let"`, `Const = "const"`), so the
 * printer reads it directly. `Namespace` selects the keyword a module
 * declaration with an identifier name prints: with the flag it is `namespace
 * A`, without it `module A`. A string-literal name is always `module "…"`, so
 * the flag says nothing there. A string-valued enum (deliberately not `const
 * enum`, so consumers compiled with `isolatedModules` can still reference its
 * members).
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export enum NodeFlags {
  None = "",
  Let = "let",
  Const = "const",
  Namespace = "namespace",
}
