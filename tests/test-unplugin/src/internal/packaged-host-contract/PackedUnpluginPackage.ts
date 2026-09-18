/** The `@ttsc/unplugin` package as `pnpm pack` publishes it, extracted to disk. */
export interface PackedUnpluginPackage {
  /** The packed `package.json`, with `workspace:` ranges rewritten as published. */
  manifest: Record<string, any>;
  /** Directory the tarball was extracted to. */
  packageRoot: string;
}
