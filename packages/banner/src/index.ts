import path from "node:path";

import type { ITtscBannerPluginConfig } from "./structures";

export * from "./structures/index";

type TtscPluginDescriptor = {
  name: string;
  source: string;
  stage?: "check" | "transform";
};

type TtscPluginFactoryContext<TConfig> = {
  binary: string;
  cwd: string;
  plugin: TConfig;
  projectRoot: string;
  tsconfig: string;
};

export default function createTtscBanner(
  _context: TtscPluginFactoryContext<ITtscBannerPluginConfig>,
): TtscPluginDescriptor {
  return {
    name: "@ttsc/banner",
    source: path.resolve(__dirname, "..", "plugin"),
    stage: "transform",
  };
}
