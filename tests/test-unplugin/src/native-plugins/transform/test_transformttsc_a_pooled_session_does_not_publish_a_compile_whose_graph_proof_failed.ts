import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadApi } from "../../internal/real-native-envelope/loadApi";

/**
 * Verifies a pooled host session never publishes a compile whose graph proof
 * failed on the worker that made it, so the retry compiles instead of adopting
 * the same failed state back (samchon/ttsc#1468).
 *
 * A compile is published under the project state it read, and that state names
 * the walk alone: a graph input outside the walk, a package's declarations,
 * does not enter it. A compile whose proof of such an input failed would be
 * published under a state its own walk still holds, then adopted by the retry
 * for the same state and by every other worker, each failing the same proof, so
 * a pool would compile nothing else until its attempts ran out.
 *
 * 1. Open a cache sharing a session on a project whose entry imports a package,
 *    and let the first proof of the package's declarations read bytes other
 *    than the compiler read, as a write landing during the compile does.
 * 2. Assert the entry is served, and that the project compiled twice: the compile
 *    whose proof failed, and the retry the session did not answer from it.
 */
export async function test_transformttsc_a_pooled_session_does_not_publish_a_compile_whose_graph_proof_failed(): Promise<void> {
  TestUnpluginProject.ensureSharedCacheDir();
  const api = await loadApi();
  const root = TestProject.tmpdir("ttsc-unplugin-session-unpublished-");
  const session = TestProject.tmpdir("ttsc-unplugin-session-store-");
  // The host matrix's linked plugin, whose compile carries the reference graph
  // and counts itself in `.ttsc/contract-runs`.
  const contributor = path.resolve(
    import.meta.dirname,
    "../../../../../experimental/test-unplugin/assets/linked/contract",
  );
  TestProject.writeFiles(root, {
    "package.json": JSON.stringify({ private: true, type: "module" }),
    "plugin.cjs": `module.exports = () => ({ name: "contract", source: ${JSON.stringify(contributor)} });\n`,
    "src/contract-input.server.ts": 'export type ContractInput = "FIRST";\n',
    "src/globals.d.ts": "declare function watchValue(): string;\n",
    "node_modules/pkg/index.d.ts": "export type Value = string;\n",
    "node_modules/pkg/package.json": JSON.stringify({
      name: "pkg",
      types: "index.d.ts",
    }),
    "src/main.ts":
      'import type { Value } from "pkg";\nexport const value: Value = watchValue();\n',
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        plugins: [{ transform: "./plugin.cjs" }],
        target: "ES2022",
        types: [],
      },
      include: ["src"],
    }),
  });
  const declarations = path.join(root, "node_modules", "pkg", "index.d.ts");
  // The walk never reads below `node_modules`, so the first read of the
  // declarations is the proof after the first compile.
  let proven = false;
  const cache = api.createTtscTransformCache({
    readFile: (location: string) => {
      const contents = fs.readFileSync(location);
      if (!proven && path.resolve(location) === declarations) {
        proven = true;
        return Buffer.concat([contents, Buffer.from("// rewritten\n")]);
      }
      return contents;
    },
  });
  api.shareTtscTransformCache(cache, session);
  api.beginTtscTransformBuild(cache);
  const entry = path.join(root, "src", "main.ts");
  const result = await api.transformTtsc(
    entry,
    fs.readFileSync(entry, "utf8"),
    api.resolveOptions({ project: path.join(root, "tsconfig.json") }),
    undefined,
    cache,
  );
  assert.ok(proven, "the proof read the package's declarations");
  assert.match(result?.code ?? "", /"FIRST"/, "the entry is served");
  assert.equal(
    fs.statSync(path.join(root, ".ttsc", "contract-runs")).size,
    2,
    "the compile whose proof failed, and the retry",
  );
}
