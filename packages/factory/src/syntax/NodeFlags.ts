/**
 * Flags for {@link factory.createVariableDeclarationList}.
 *
 * Outline of the relevant subset of the legacy `ts.NodeFlags`.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export enum NodeFlags {
  None = 0,
  Let = 1,
  Const = 2,
}
