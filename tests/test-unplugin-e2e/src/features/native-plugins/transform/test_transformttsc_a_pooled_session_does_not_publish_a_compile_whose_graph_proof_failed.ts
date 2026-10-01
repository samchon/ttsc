import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadApi } from "../../../internal/real-native-envelope/loadApi";

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
 *
 * @evidence contracts/testing.md#behavioral-verification The first cache read of an external package declaration is altered after native compilation. transformTtsc must still serve FIRST from a second native capture; assertions require the mismatch hook to run and contract-runs size two, catching adoption of the rejected first publication.
 * @evidence contracts/testing.md#independent-expectations The seam returns bytes other than those the native compiler read only once. Independent contributor log bytes and literal FIRST output require a fresh capture after failed proof. This does not inspect the session file directly; the retry count detects reuse of the invalid publication.
 * @evidence contracts/testing.md#distinguishing-cases A graph input outside the project walk fails its first content proof while the walk remains stable, then unchanged real bytes permit recovery. The adjacent plugin-writing-below-root pooled entry provides the harmless root-mutation adoption control.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_pooled_session_does_not_publish_a_compile_whose_graph_proof_failed in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary Real native graph hashing, JS post-compile proof and filesystem session publication participate in one retry wave. A pure walk-key calculation cannot show failed graph proof prevents the retry from adopting its own rejected native capture.
 * @evidence contracts/e2e.md#shared-execution One fixed linked contributor artifact, native build cache, project, session store and JS cache serve both attempts. Only the first proof read is adversarial, requiring one fresh capture rather than another installation or native producer build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique project/session paths prevent a warm publication bypassing the first-proof seam. proven flips once so the retry reads actual bytes, and its assertion ensures the intended invalidation occurred. This entry has no explicit cache reset; its build-pass resources and TestProject paths end with the runner.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_pooled_session_does_not_publish_a_compile_whose_graph_proof_failed; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
