import fs from "node:fs";
import path from "node:path";

/**
 * Writes `tsconfig.unplugin.json` at `root`, extending `tsconfig.json` with the
 * fixture plugin. Used by both `assertTransformUsesProjectOption` and
 * `assertTransformUsesRelativeProjectOption`.
 */
export function writeUnpluginProject(root: string): void {
  fs.writeFileSync(
    path.join(root, "tsconfig.unplugin.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}
