import path from "node:path";

/** Universal descriptor/config files loaded by the fixture host. */
export function fixtureHostInputs(root: string): string[] {
  return ["package.json", "plugin.cjs", "tsconfig.json"].map((file) =>
    path.join(root, file),
  );
}
