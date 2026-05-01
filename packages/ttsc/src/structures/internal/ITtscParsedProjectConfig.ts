import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";

/** Resolved project config subset used inside the ttsc host. */
export interface ITtscParsedProjectConfig {
  /** Compiler options after extends inheritance has been applied. */
  compilerOptions: {
    /** Absolute output directory when configured. */
    outDir?: string;
    /** Project plugin entries after inheritance resolution. */
    plugins: ITtscProjectPluginConfig[];
  } & Record<string, unknown>;
  /** Absolute path to the resolved tsconfig/jsconfig. */
  path: string;
  /** Directory containing the resolved tsconfig/jsconfig. */
  root: string;
}
