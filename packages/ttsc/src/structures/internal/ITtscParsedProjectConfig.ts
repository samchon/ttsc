import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";
import type { ITtscProjectIdentity } from "./ITtscProjectIdentity";

/** Resolved project config subset used inside the ttsc host. */
export interface ITtscParsedProjectConfig {
  /** Every resolved tsconfig/jsconfig in the inherited `extends` chain. */
  configPaths: readonly string[];
  /** Compiler options after extends inheritance has been applied. */
  compilerOptions: {
    /** Absolute output directory when configured. */
    outDir?: string;
    /** Project plugin entries after inheritance resolution. */
    plugins: ITtscProjectPluginConfig[];
  } & Record<string, unknown>;
  /** Lexical and physical identities retained for native plugin contexts. */
  identity: Omit<ITtscProjectIdentity, "pluginConfigOrigin">;
  /** Absolute path to the resolved tsconfig/jsconfig. */
  path: string;
  /** Directory that declared each inherited plugin entry. */
  pluginBaseDirs: string[];
  /** Directory containing the resolved tsconfig/jsconfig. */
  root: string;
}
