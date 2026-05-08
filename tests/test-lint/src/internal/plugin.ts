import { createRequire } from "node:module";
import path from "node:path";

import { workspaceRoot } from "@ttsc/testing";

const requireFromTest = createRequire(
  path.join(workspaceRoot, "tests", "test-lint", "package.json"),
);

export namespace TestLintPlugin {
  export const PACKAGE_ROOT = path.join(workspaceRoot, "packages", "lint");
  export const DESCRIPTOR_PATH = path.join(PACKAGE_ROOT, "lib", "index.js");
  export const NATIVE_PLUGIN_DIR = path.join(PACKAGE_ROOT, "plugin");

  export function loadFactory() {
    const mod = requireFromTest(DESCRIPTOR_PATH);
    return mod.createTtscPlugin ?? mod.default ?? mod;
  }

  export function factoryContext(plugin: Record<string, unknown>) {
    return {
      binary: "",
      cwd: process.cwd(),
      plugin,
      projectRoot: PACKAGE_ROOT,
      tsconfig: path.join(PACKAGE_ROOT, "tsconfig.json"),
    };
  }
}
