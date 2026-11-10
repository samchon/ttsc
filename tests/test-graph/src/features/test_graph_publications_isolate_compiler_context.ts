import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CapabilityPluginResolver } from "ttsc";

import { publishArtifactsResident } from "../../../../packages/graph/src/model/publishedArtifacts";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Keep positive publications under different compiler contexts independent.
 * Explicit resolver and daemon ports exercise capture before asynchronous
 * discovery, both publication phases and direct fallback without a compiler.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the real resident publication owner with authored dependency ports and reads its actual exchange files. Both phases must share the captured environment, fallback must receive that same object, and a second context must not overwrite the first publication.
 * @evidence contracts/testing.md#independent-expectations Literal argv, cwd, node records and an environment edit during discovery define expected behavior independently of the implementation's hash or serialization helpers.
 * @evidence contracts/testing.md#distinguishing-cases Explicit true and false override inherited true, changed argument cwd separates otherwise identical publications, and an unchanged context reuses its exchange path. Positive artifacts distinguish accidental overwrites from legitimate empty output.
 * @evidence contracts/testing.md#execution-ownership Runs source publication code with explicit SDK and daemon contracts; no compiler or native product process is launched. Every discovery proof is released and only returned, verified task-owned exchange paths are removed.
 */
export async function test_graph_publications_isolate_compiler_context(): Promise<void> {
  const cwd = TestProject.tmpdir("graph-publication-context-");
  const files = new Set<string>();
  const plugin = { binary: "publisher", manifest: "manifest" };
  const records: string[] = [];
  try {
    for (const [index, permission, argumentCwd] of [
      [0, true, "first"],
      [1, false, "first"],
      [2, true, "second"],
      [3, true, "first"],
    ] as const) {
      const inherited = {
        TTSC_TSGO_ARGS: '["--runExternalCode=true"]',
        TTSC_TSGO_ARGS_CWD: path.join(cwd, argumentCwd),
      };
      const expectedArgs = [
        "--runExternalCode=true",
        "--runExternalCode",
        String(permission),
      ];
      const expectedCwd = inherited.TTSC_TSGO_ARGS_CWD;
      let captured: NodeJS.ProcessEnv | undefined;
      const verbs: string[] = [];
      let released = false;
      const proof: CapabilityPluginResolver.Resolution = {
        status: "resolved",
        plugins: [plugin],
        isCurrent: async () => true,
        release: async () => {
          released = true;
        },
      };
      const nodes = [
        {
          id: "docs/choice.md",
          kind: "markdown_document",
          name: `publication ${index}`,
          file: "docs/choice.md",
          external: false,
          evidence: { startLine: 1 },
        },
      ];
      const published = await publishArtifactsResident(
        {
          cwd,
          tsconfig: "tsconfig.json",
          runExternalCode: permission,
          environment: inherited,
        },
        (_plugin, environment) => {
          captured ??= environment;
          assert.equal(environment, captured);
          assert.deepEqual(
            JSON.parse(environment.TTSC_TSGO_ARGS!),
            expectedArgs,
          );
          assert.equal(environment.TTSC_TSGO_ARGS_CWD, expectedCwd);
          return undefined;
        },
        {
          resolve: async () => {
            inherited.TTSC_TSGO_ARGS_CWD = "changed during discovery";
            return proof;
          },
          runCommand: async (_command, args, options) => {
            assert.equal(options.env, captured);
            verbs.push(args[0]!);
            return {
              pid: 1,
              output: [],
              stdout:
                args[0] === "project-inputs" ? "{}" : JSON.stringify(nodes),
              stderr: "",
              status: 0,
              signal: null,
            };
          },
        },
      );
      try {
        assert.deepEqual(verbs, ["project-inputs", "graph-nodes"]);
        assert.ok(published.file);
        assert.equal(path.dirname(published.file), os.tmpdir());
        assert.ok(
          path
            .basename(published.file)
            .startsWith(`ttsc-graph-artifacts-${process.pid}-`),
        );
        files.add(published.file);
        records.push(published.file);
        assert.deepEqual(
          JSON.parse(fs.readFileSync(published.file, "utf8")),
          nodes,
        );
        if (index === 1) {
          assert.notEqual(records[0], records[1]);
          assert.equal(
            JSON.parse(fs.readFileSync(records[0]!, "utf8"))[0].name,
            "publication 0",
          );
        }
      } finally {
        await published.discovery.release();
      }
      assert.equal(released, true);
    }
    assert.notEqual(records[0], records[2]);
    assert.equal(records[0], records[3]);
  } finally {
    for (const file of files) fs.rmSync(file);
  }
}
