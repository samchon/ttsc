/**
 * Pack `@ttsc/unplugin` exactly as it would be published and return the packed
 * `package.json`.
 *
 * `pnpm pack` is offline and deterministic, and it rewrites `workspace:^` to
 * the concrete caret range a real consumer's package manager sees — the
 * published dependency contract. Reading that manifest (rather than the source
 * one) is what proves the contract a clean install would receive, without a
 * network install.
 */
export interface PackedUnpluginPackage {
  manifest: Record<string, any>;
  packageRoot: string;
}
