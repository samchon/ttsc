import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type createTtscPlugin from "../../../../../packages/lint/src/createTtscPlugin";

/** Source-level descriptor inputs, with no installed package or native host. */
export namespace TestLintPlugin {
  export const PACKAGE_ROOT = fileURLToPath(new URL("../../../../../packages/lint/", import.meta.url));
  export const DESCRIPTOR_PATH = path.join(PACKAGE_ROOT, "src", "createTtscPlugin.ts");
  export const NATIVE_PLUGIN_DIR = path.join(PACKAGE_ROOT, "plugin");

  export function loadFactory() {
    return (createRequire(import.meta.url)(DESCRIPTOR_PATH) as { default: typeof createTtscPlugin }).default;
  }

  export function factoryContext(plugin: Record<string, unknown>) {
    return {
      binary: "",
      cwd: process.cwd(),
      dirname: path.dirname(DESCRIPTOR_PATH),
      filename: DESCRIPTOR_PATH,
      plugin,
      projectRoot: PACKAGE_ROOT,
      tsconfig: path.join(PACKAGE_ROOT, "tsconfig.json"),
    };
  }
}
