/** The `@ttsc/unplugin` package as `pnpm pack` publishes it, extracted to disk. */
export interface PackedUnpluginPackage {
  /** The packed `package.json`, with `workspace:` ranges rewritten as published. */
  manifest: Record<string, any>;
  /** The extracted package directory, `<destination>/extract/package`. */
  packageRoot: string;
}
