import { TestUnpluginProject } from "@ttsc/testing";
import path from "node:path";

/**
 * The universal inputs a fixture transform registers: the descriptor and config
 * files the host loads, and the Go source directory its plugin was built from,
 * which is as universal an input as they are (samchon/ttsc#1487).
 */
export function fixtureHostInputs(root: string): string[] {
  return [
    ...["package.json", "plugin.cjs", "tsconfig.json"].map((file) =>
      path.join(root, file),
    ),
    TestUnpluginProject.pluginSource(root),
  ];
}
