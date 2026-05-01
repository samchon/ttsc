import path from "node:path";
import type {
  ITtscPlugin,
  ITtscPluginFactoryContext,
} from "ttsc";

import type { ITtscLintPluginConfig } from "./structures";

export * from "./structures/index";

export default function createTtscPlugin(
  _context: ITtscPluginFactoryContext<ITtscLintPluginConfig>,
): ITtscPlugin {
  return {
    name: "@ttsc/lint",
    source: path.resolve(__dirname, "..", "plugin"),
    stage: "check",
  };
}
