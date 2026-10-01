import { TestProject } from "@ttsc/testing";

import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeSharedCompilerPlugin,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.transform surfaces the exact files consulted by the
 * JavaScript plugin host before native transformation.
 *
 * Bundler caches need descriptor, manifest, and explicit config freshness for
 * every output, but must not promote arbitrary unclassified project files to
 * universal inputs. A missing explicit config path is state too: its later
 * creation must invalidate the generation.
 *
 * 1. Create a plugin project with a missing explicit config and an unrelated
 *    asset.
 * 2. Transform it through the programmatic API.
 * 3. Assert only config ancestry, manifest, descriptor, and config path surface.
 *
 * @evidence contracts/testing.md#behavioral-verification transform reports exact config, package manifest, descriptor and missing explicit config paths while omitting notes.md.
 * @evidence contracts/testing.md#independent-expectations host provenance consists of consulted inputs; unrelated assets must not be promoted to universal inputs; the fixture producer's explicit output is input to the host contract rather than an oracle for compiler AST semantics.
 * @evidence contracts/testing.md#distinguishing-cases missing explicit config is retained while a present unrelated notes file is omitted.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsccompiler_transform_surfaces_exact_host_inputs function is an API E2E entry under src/features/api; it executes descriptor/config loading, actual native transform and API provenance publication.
 * @evidence contracts/e2e.md#necessary-boundary This case owns descriptor/config loading, actual native transform and API provenance publication; direct decoder or option calls cannot prove this assembly and caller-visible behavior.
 * @evidence contracts/e2e.md#shared-execution Five API consumers share one process-owned immutable compiler producer source and its keyed binary. Private descriptors, projects and API instances retain each case's inputs; source-mutation, proof-path and cold-cache cases keep their isolated producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared Go bytes never change in these five consumers; the product validates source, SDK and environment keys before artifact reuse. Each descriptor and project is private, and the synchronous transform completes before its private input tree is reclaimed. TestProject retains the immutable source until process exit and cleans it on exit.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and counterexample below remains; only source preparation is shared, and the native envelope decoder matrix executes separately in source units.
 */
export function test_ttsccompiler_transform_surfaces_exact_host_inputs() {
  const root = TestProject.physicalPath(
    createProject({
      plugins: [
        { transform: "./plugin.cjs", configFile: "missing.plugin.config.json" },
      ],
      source: 'export const value = goUpper("plugin");\n',
    }),
  );
  writeSharedCompilerPlugin(root);
  fs.writeFileSync(path.join(root, "notes.md"), "not a host input\n", "utf8");

  const result = new TtscCompiler({ binary: tsgo, cwd: root }).transform();

  assert.equal(result.type, "success");
  assert.deepEqual(result.hostInputs, [
    path.join(root, "missing.plugin.config.json"),
    path.join(root, "package.json"),
    path.join(root, "plugin.cjs"),
    path.join(root, "tsconfig.json"),
  ]);
}
