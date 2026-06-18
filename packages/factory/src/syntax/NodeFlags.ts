/**
 * Flags for {@link factory.createVariableDeclarationList} and
 * {@link factory.createModuleDeclaration}.
 *
 * An outline of the relevant subset of the legacy `ts.NodeFlags`. Each member's
 * value is the keyword it implies (`Let = "let"`, `Const = "const"`), so the
 * printer reads it directly. `Namespace` is accepted for API parity — the
 * printer renders the `module` / `namespace` keyword from the module name kind,
 * not from this flag. A string-valued `const enum`, so references inline with
 * no runtime object.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export const enum NodeFlags {
  None = "",
  Let = "let",
  Const = "const",
  Namespace = "namespace",
}
