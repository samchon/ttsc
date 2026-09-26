import { TestUnpluginProject } from "@ttsc/testing";
import path from "node:path";

import { member } from "./member";

/**
 * The universal inputs a fixture transform registers: the descriptor and config
 * files the host loads, and the Go source directory its plugin was built from,
 * which is as universal an input as they are (samchon/ttsc#1487). A delivery
 * also registers the nearer config it looked for beside the delivered file and
 * did not find, whose appearance would move the file to another project
 * (samchon/ttsc#1543).
 *
 * @param root The fixture project root.
 * @param file The delivered module, `src/main.ts` by default.
 */
export function fixtureHostInputs(
  root: string,
  file: string = TestUnpluginProject.mainFile(root),
): string[] {
  return [
    ...["package.json", "plugin.cjs", "tsconfig.json"].map((name) =>
      member(root, name),
    ),
    path.join(path.dirname(file), "tsconfig.json"),
    TestUnpluginProject.pluginSource(root),
  ];
}
