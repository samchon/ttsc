import { TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { seedUtilityPlugin } from "./seedUtilityPlugin";

/** Create a fixture project wired to one utility plugin. */
export function createUtilityPluginProject(props: {
  files?: Record<string, string>;
  plugin: "banner" | "strip";
  pluginEntry?: Record<string, unknown>;
  source: string;
}): string {
  const root = TestUnpluginProject.createProject({
    plugins: [
      { transform: `@ttsc/${props.plugin}`, ...(props.pluginEntry ?? {}) },
    ],
    source: props.source,
  });
  for (const [name, text] of Object.entries(props.files ?? {})) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, "utf8");
  }
  seedUtilityPlugin(root, props.plugin);
  return root;
}
