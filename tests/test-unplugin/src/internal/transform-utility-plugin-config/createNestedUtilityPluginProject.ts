import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { seedUtilityPlugin } from "./seedUtilityPlugin";

/**
 * Materialize a project two directories below its plugin config.
 *
 * The layout a monorepo produces: the config sits at the workspace root and the
 * package that compiles is nested below it, so discovery finds the config by
 * walking up through a directory that belongs to neither.
 *
 * The middle directory is what makes a scenario built on this fixture prove
 * anything. A config created inside the project root is caught by the adapter's
 * own project-membership snapshot no matter what the plugin reports, so only a
 * config appearing _outside_ that walk isolates the probe reporting.
 */
export function createNestedUtilityPluginProject(props: {
  plugin: "banner" | "strip";
  outerConfig?: string;
  source: string;
}): { middle: string; root: string } {
  const outer = TestProject.tmpdir(`ttsc-${props.plugin}-outer-`);
  const middle = path.join(outer, "packages");
  const root = path.join(middle, "app");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "commonjs",
          outDir: "dist",
          plugins: [{ transform: `@ttsc/${props.plugin}` }],
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(path.join(root, "src", "main.ts"), props.source, "utf8");
  if (props.outerConfig !== undefined) {
    fs.writeFileSync(
      path.join(outer, `${props.plugin}.config.json`),
      props.outerConfig,
      "utf8",
    );
  }
  seedUtilityPlugin(root, props.plugin);
  return { middle, root };
}
