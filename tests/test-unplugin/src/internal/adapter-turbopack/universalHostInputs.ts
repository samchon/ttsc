import path from "node:path";

/** Exact compiler/descriptor inputs that affect every transformed module. */
export function universalHostInputs(root: string): string[] {
  return ["package.json", "plugin.cjs", "tsconfig.json"].map((file) =>
    path.join(root, file),
  );
}
