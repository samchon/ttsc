import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies a TypeScript lint config reports namespace normalization collisions
 * after ttsx evaluates the config.
 *
 * TypeScript configs take a subprocess extractor path, so a CJS-only regression
 * would leave the production boundary unproved. The collision must reach the
 * common descriptor resolver with the original namespace vocabulary intact
 * instead of silently discarding one evaluated plugin object.
 *
 * 1. Materialize two distinct contributor source directories in a temp project.
 * 2. Write a `.ts` config whose namespaces both normalize to `react_hooks`.
 * 3. Run the built `ttsx` launcher through the factory and assert the path, both
 *    names, and Go name.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ttsx evaluation supplies react-hooks and react_hooks contributor objects to the emitted descriptor, which must throw an error naming the TS config, both namespaces and their common Go name.
 * @evidence contracts/testing.md#independent-expectations Go contributor names replace hyphens with underscores, so these independently authored distinct namespaces collide at react_hooks; literal error fragments verify the preserved input vocabulary.
 * @evidence contracts/testing.md#distinguishing-cases This TS evaluator connection complements the CJS connection; direct normalizeContributors units own ordering, three-way collisions, duplicate source handling and independent names.
 * @evidence contracts/testing.md#execution-ownership The named entry loads the emitted factory and real ttsx launcher; the source normalization unit does not claim to execute this evaluator connection.
 * @evidence contracts/e2e.md#necessary-boundary The typed-config evaluator must serialize both distinct contributor registrations before common normalization; a CJS-only or direct normalization test cannot detect loss in that subprocess connection.
 * @evidence contracts/e2e.md#shared-execution One typed config and one evaluator invocation preserve this connection. The case reuses emitted compiler/launcher artifacts and creates only source directories, never compiling their Go code.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh project owns both immutable contributor directories; the launcher override is restored and the project removed in finally. No previous successful descriptor masks the collision.
 * @evidence contracts/e2e.md#preserved-coverage The original TS filename, ordered two namespace names and normalized Go-name error assertions remain; source units preserve additional normalization decisions without repeating this evaluator preparation.
 */
export function test_descriptor_rejects_colliding_contributor_namespaces_from_typescript_config() {
    const project = createLintProject({
      name: "contributor-namespace-typescript",
      source: "export const value = 1;\n",
      pluginConfig: { configFile: "./lint.config.ts" },
    });
    const previousTtsxBinary = process.env.TTSC_TTSX_BINARY;
    process.env.TTSC_TTSX_BINARY = TestProject.TTSX_BIN;
    try {
      const first = createContributorSource(project.tmpdir, "first");
      const second = createContributorSource(project.tmpdir, "second");
      fs.writeFileSync(
        path.join(project.tmpdir, "lint.config.ts"),
        `export default {
  plugins: {
    "react-hooks": { source: ${JSON.stringify(first)} },
    react_hooks: { source: ${JSON.stringify(second)} },
  },
};
`,
      );

      const factory = TestLintPlugin.loadFactory();
      assert.throws(
        () =>
          factory({
            ...TestLintPlugin.factoryContext({ transform: "@ttsc/lint" }),
            cwd: project.tmpdir,
            pluginConfigDir: project.tmpdir,
            projectRoot: project.tmpdir,
            tsconfig: path.join(project.tmpdir, "tsconfig.json"),
          }),
        (error) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /lint\.config\.ts/);
          assert.match(
            error.message,
            /"react-hooks", "react_hooks" all normalize to "react_hooks"/,
          );
          return true;
        },
      );
    } finally {
      if (previousTtsxBinary === undefined) {
        delete process.env.TTSC_TTSX_BINARY;
      } else {
        process.env.TTSC_TTSX_BINARY = previousTtsxBinary;
      }
      project.cleanup();
    }
  }

function createContributorSource(root: string, name: string): string {
  const directory = path.join(root, "contributors", name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "rule.go"), "package contributor\n");
  return directory;
}
