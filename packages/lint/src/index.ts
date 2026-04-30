import path from "node:path";
import type {
  ITtscProjectPluginConfig,
  ITtscPlugin,
  ITtscPluginFactoryContext,
} from "ttsc";

import type { ITtscLintConfig } from "./structures/ITtscLintConfig";

export * from "./structures/ITtscLintConfig";
export * from "./structures/ITtscLintRule";
export * from "./structures/ITtscLintSeverity";

export type ITtscLintPluginConfig = ITtscProjectPluginConfig & {
  config?: string | ITtscLintConfig;
};

export function createTtscPlugin(
  _context: ITtscPluginFactoryContext<ITtscLintPluginConfig>,
): ITtscPlugin {
  return {
    name: "@ttsc/lint",
    native: {
      mode: "ttsc-lint",
      source: {
        dir: path.resolve(__dirname, ".."),
        entry: "./plugin",
      },
      contractVersion: 1,
      capabilities: ["check"],
    },
  };
}

export default createTtscPlugin;
