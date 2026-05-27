import type { IMemFSHost } from "@ttsc/wasm";

/** Options for the typia integration of {@link createWorkerCompiler}. */
export interface ITypiaPluginConfig {
  /** Plugin id registered with `host.Expose` (default: `"typia"`). */
  name?: string;
  /**
   * Module specifier the typia transform receives via
   * `compilerOptions.plugins` (default: `"typia/lib/transform"`).
   */
  transformModule?: string;
  /**
   * Optional hook to mount typia source files into the MemFS during boot.
   * The site fetches its pre-built typia pack and writes it under
   * `<workDir>/node_modules/`. `workDir` is forwarded from
   * `createWorkerCompiler` so the mount can honor a non-default project
   * root without the site rewiring the URL.
   */
  mount?: (host: IMemFSHost, workDir: string) => Promise<void>;
}
