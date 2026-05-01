import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

/** Project context passed to `createTtscPlugin()` factories. */
export interface ITtscPluginFactoryContext<T = ITtscProjectPluginConfig> {
  /** Absolute TypeScript-Go binary selected for this invocation. */
  binary: string;
  /** Current working directory requested by the caller. */
  cwd: string;
  /** Original `compilerOptions.plugins[]` entry that loaded this plugin. */
  plugin: T;
  /** Directory containing the resolved tsconfig/jsconfig. */
  projectRoot: string;
  /** Absolute path to the resolved tsconfig/jsconfig. */
  tsconfig: string;
}
