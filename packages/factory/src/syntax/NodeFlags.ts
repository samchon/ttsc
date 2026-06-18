/**
 * Flags for {@link factory.createVariableDeclarationList} and
 * {@link factory.createModuleDeclaration}.
 *
 * Outline of the relevant subset of the legacy `ts.NodeFlags`, kept as a
 * bit-flag set like the legacy enum. `Namespace` is accepted for API parity:
 * the printer renders the `module` / `namespace` keyword from the module name
 * kind, not from this flag.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export enum NodeFlags {
  None = 0,
  Let = 1,
  Const = 2,
  Namespace = 256,
}
