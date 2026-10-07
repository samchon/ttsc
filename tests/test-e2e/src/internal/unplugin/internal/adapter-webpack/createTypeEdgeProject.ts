import { TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

/**
 * The interface `src/mytype.ts` starts with; the fixture plugin embeds the
 * uppercased file content into the transformed output, mirroring a type-driven
 * generator whose output depends on a consulted declaration.
 */
const MYTYPE_V1 = "export interface MyType { id: string }\n";

/**
 * Create the reproduction project from samchon/ttsc#716: `src/main.ts` reaches
 * `src/mytype.ts` only through a type-only import (webpack erases the edge from
 * its module graph), while the fixture plugin's output embeds the file's
 * content. `withGraph` toggles the producer emitting the reference graph edge —
 * the invalidation channel under test.
 *
 * `declareComplete` additionally declares `src/main.ts`'s dependency list
 * complete (samchon/ttsc#720) while the producer reports no dependencies at
 * all, which is the under-declaration defect: the plugin genuinely reads
 * `src/mytype.ts` but vouches for a list that omits it.
 */
export function createTypeEdgeProject(
  withGraph: boolean,
  declareComplete = false,
  runLog?: string,
): string {
  const plugins: unknown[] = [
    {
      transform: "./plugin.cjs",
      name: "reader",
      operation: "read-configured-helper",
      path: "src/mytype.ts",
    },
  ];
  if (withGraph) {
    plugins.push({
      transform: "./plugin.cjs",
      name: "graph",
      operation: "emit-graph",
      edges: { "src/main.ts": ["src/mytype.ts"] },
    });
  }
  if (runLog !== undefined) {
    // Opt-in counter: the fixture plugin appends one byte per whole-project
    // transform, which is the only way to observe compiles from outside a
    // running bundler.
    plugins.push({
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog,
    });
  }
  if (declareComplete) {
    plugins.push({
      transform: "./plugin.cjs",
      name: "completeness",
      operation: "declare-complete",
      complete: ["src/main.ts"],
    });
  }
  const root = TestUnpluginProject.createProject({
    plugins,
    source:
      'import type { MyType } from "./mytype";\n' +
      'export const value: string = goUpper("plugin");\n' +
      "console.log(value);\n",
  });
  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V1, "utf8");
  return root;
}
