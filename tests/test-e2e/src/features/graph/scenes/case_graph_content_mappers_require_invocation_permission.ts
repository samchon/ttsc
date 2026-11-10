import { TtscGraphSession, loadGraph } from "@ttsc/graph";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  TtsgraphClient,
  resolveGraphLauncher,
  resolveTtscgraphBinary,
} from "../../../internal/graph/internal/ttsgraph";

/**
 * Verifies explicit permission connects every graph entry to upstream mappers.
 *
 * A mapper changes raw numeric data into TypeScript. Its original input and
 * declared schema must remain the resident generation's freshness inputs.
 *
 * 1. Reject default and explicitly denied loads, and accept CLI/API permission.
 * 2. Reuse unchanged snapshots, remap source edits, and reload config/schema.
 * 3. Resolve the mapped declaration through the real MCP launcher and close it.
 *
 * @evidence contracts/testing.md#behavioral-verification Built CLI, loader, resident session and MCP execute a real framed Node mapper; defaults and explicit false fail, mapped declarations/imports resolve, unchanged requests reuse their model, and source/config/schema changes refresh it.
 * @evidence contracts/testing.md#independent-expectations Authored numeric inputs prescribe literal 42/43 sets on the exported type alias; changing the schema to number removes the finite set. Permission denial must retain upstream's runExternalCode message.
 * @evidence contracts/testing.md#distinguishing-cases Covers omitted versus true/false permission, inherited true withdrawn by false, nonidentity mapping, unchanged reuse, mapped source edits, structural reload and external mapper-input changes.
 * @evidence contracts/testing.md#execution-ownership Discovered through test_e2e_graph_batch; one private project shares the built 7.1 native binary and graph package across CLI/API/MCP boundary checks.
 * @evidence contracts/e2e.md#necessary-boundary Actual flag transport, compiler permission, external mapper IO and resident snapshot publication cannot be proven by parser-only units.
 * @evidence contracts/e2e.md#shared-execution Reuses the batch's built graph SDK and producer; all mapper cases share one authored project and one resident edit/reload sequence, without installing or building a host per case.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project and mapper log are private. Session close and MCP stdin/exit joins finish before exit-owned fixture cleanup; unresolved closure retains the inputs.
 * @evidence contracts/e2e.md#preserved-coverage Adds the previously missing content-mapper boundary while existing graph scenes retain ordinary native, permission-repair and cancellation coverage.
 */
export async function case_graph_content_mappers_require_invocation_permission(): Promise<void> {
  const authored = FixtureFiles.read("graph/content-mappers");
  const files = Object.fromEntries(
    Object.entries(authored).map(([name, text]) => [
      name.startsWith("mapper/")
        ? name.replace("mapper/", "node_modules/minimal-mapper/")
        : name,
      text,
    ]),
  );
  const root = TestProject.createProject(files);
  const binary = path.join(
    path.dirname(resolveTtscgraphBinary()),
    process.platform === "win32" ? "ttscgraph-7.1.exe" : "ttscgraph-7.1",
  );
  const launcher = resolveGraphLauncher();
  const nativeEnv = {
    TTSC_GRAPH_BINARY: binary,
    TTSC_TSGO_ARGS: undefined,
    TTSC_TSGO_ARGS_CWD: undefined,
  };
  const dump = (args: string[], inherited?: string) =>
    TestProject.spawn(
      process.execPath,
      [launcher, "dump", "--cwd", root, ...args],
      {
        cwd: root,
        env: { ...nativeEnv, TTSC_TSGO_ARGS: inherited },
      },
    );
  const denied = dump([]);
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /runExternalCode/);
  const withdrawn = dump(
    ["--runExternalCode=false"],
    '["--runExternalCode","true"]',
  );
  assert.equal(withdrawn.status, 1);
  assert.match(withdrawn.stderr, /runExternalCode/);
  const accepted = dump(["--runExternalCode"]);
  assert.equal(accepted.status, 0, accepted.stderr);
  const raw = JSON.parse(accepted.stdout) as {
    nodes: { id: string; name: string; file: string; literals?: string[] }[];
    edges: { to: string }[];
  };
  const mapped = raw.nodes.find(
    (node) => node.name === "answer" && node.file === "answer.data",
  );
  assert.ok(mapped);
  assert.ok(raw.edges.some((edge) => edge.to === mapped.id));
  assert.deepEqual(raw.nodes.find((node) => node.name === "Answer")?.literals, [
    "42",
  ]);
  assert.throws(
    () => loadGraph({ cwd: root, binary, runExternalCode: false }),
    /runExternalCode/,
  );
  assert.ok(
    loadGraph({ cwd: root, binary, runExternalCode: true }).nodes.some(
      (node) => node.name === "answer",
    ),
  );

  const session = new TtscGraphSession({
    cwd: root,
    tsconfig: "tsconfig.json",
    binary,
    runExternalCode: true,
  });
  let closed = false;
  const literals = (graph: {
    nodes: readonly { name: string; literals?: readonly string[] }[];
  }) => {
    const alias = graph.nodes.find((node) => node.name === "Answer");
    assert.ok(alias, "the mapped type alias must remain present");
    return alias.literals ?? [];
  };
  try {
    const first = await session.graph();
    assert.deepEqual(literals(first), ["42"]);
    assert.equal(
      await session.graph(),
      first,
      "mapped text must not look like a concurrent disk edit",
    );
    fs.writeFileSync(path.join(root, "answer.data"), "43\n");
    const edited = await session.graph();
    assert.notEqual(edited, first);
    assert.deepEqual(literals(edited), ["43"]);
    assert.equal(await session.graph(), edited);
    fs.appendFileSync(path.join(root, "tsconfig.json"), "\n");
    const reloaded = await session.graph();
    assert.deepEqual(literals(reloaded), ["43"]);
    assert.equal(await session.graph(), reloaded);
    fs.writeFileSync(
      path.join(root, "node_modules/minimal-mapper/schema.txt"),
      "number\n",
    );
    const schema = await session.graph();
    assert.notEqual(schema, reloaded);
    assert.deepEqual(literals(schema), []);
    assert.equal(await session.graph(), schema);
  } finally {
    try {
      await session.close();
      closed = true;
    } finally {
      if (!closed)
        TestProject.retainTemporaryDirectory(
          root,
          "content mapper session closure was not established",
        );
    }
  }

  const child = E2eProcessTrace.spawn(
    process.execPath,
    [launcher, "--cwd", root, "--runExternalCode"],
    {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...nativeEnv },
      windowsHide: true,
    },
  );
  const client = TtsgraphClient.connect(child);
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "content-mapper-e2e", version: "1" },
    });
    client.notify("notifications/initialized", {});
    const result = (await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: {
        question:
          "Locate the declaration exported by the content-mapped module.",
        draft: {
          reason: "A named declaration lookup is sufficient.",
          type: "lookup",
        },
        review: "Keep the named lookup.",
        request: { type: "lookup", query: "answer" },
      },
    })) as { isError?: boolean; structuredContent?: unknown };
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.match(JSON.stringify(result.structuredContent), /answer\.data/);
  } finally {
    client.endStdin();
    try {
      assert.equal(await client.waitForExit(), 0, client.stderrText());
    } catch (error) {
      TestProject.retainTemporaryDirectory(
        root,
        "content mapper MCP closure was not established",
      );
      throw error;
    }
  }
  assert.match(
    fs.readFileSync(
      path.join(root, "node_modules/minimal-mapper/mapper.log"),
      "utf8",
    ),
    /closeProject/,
  );
}
