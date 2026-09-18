import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { seedUtilityPlugin } from "../transform-utility-plugin-config/seedUtilityPlugin";
import type { ILinkedPluginProject } from "./ILinkedPluginProject";

/**
 * Scenarios for the completeness a linked plugin declares about its own
 * contribution (samchon/ttsc#1263) and the rule the host declares under
 * (samchon/ttsc#1259).
 *
 * Every fixture here has the same shape: an entry that imports a type-only
 * sibling, so the host-owned reference bound contains a file whose content
 * cannot reach a syntactic transform's output. Whether that sibling is
 * registered as a watch input of the entry is exactly the question the
 * declaration answers.
 */

/** Name of a first-party utility plugin under test. */
type UtilityPlugin = "banner" | "paths" | "strip";

/**
 * Materialize a project whose entry imports a type-only sibling through a
 * tsconfig path alias, wired to the given linked plugins.
 *
 * The alias exists so `@ttsc/paths` has something to rewrite; the type-only
 * import exists so the reference graph carries an edge whose target cannot
 * influence a syntactic transform. The mapping is written without `baseUrl`,
 * which TypeScript 7 removed: `paths` targets resolve against the tsconfig's
 * own directory.
 */
export function createLinkedPluginProject(
  plugins: readonly UtilityPlugin[],
): ILinkedPluginProject {
  // Share one Go build cache across these fixtures; each distinct plugin set
  // still links its own host, but without this every project would rebuild the
  // host into its own `node_modules/.cache`.
  TestUnpluginProject.ensureSharedCacheDir();
  // These cases isolate content-dependency completeness. A short Windows root
  // spelling is a resolver alias whose identity must remain watched even for
  // a complete plugin, so use the physical root for this fixture.
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-linked-complete-"),
  );
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  const types = path.join(root, "src", "types.ts");
  fs.writeFileSync(
    types,
    "export interface Model {\n  id: string;\n}\n",
    "utf8",
  );
  const main = path.join(root, "src", "main.ts");
  fs.writeFileSync(
    main,
    [
      'import type { Model } from "~/types";',
      "",
      'export const value: string = ({ id: "x" } satisfies Model).id;',
      "",
    ].join("\n"),
    "utf8",
  );
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
          paths: { "~/*": ["./src/*"] },
          plugins: plugins.map((plugin) => ({ transform: `@ttsc/${plugin}` })),
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
  if (plugins.includes("banner")) {
    fs.writeFileSync(
      path.join(root, "banner.config.json"),
      JSON.stringify({ text: "Fixture Banner Text" }),
      "utf8",
    );
  }
  if (plugins.includes("strip")) {
    fs.writeFileSync(
      path.join(root, "strip.config.json"),
      JSON.stringify({ calls: ["logger.trace"], statements: [] }),
      "utf8",
    );
  }
  for (const plugin of plugins) {
    seedUtilityPlugin(root, plugin);
  }
  return { main, root, types };
}
