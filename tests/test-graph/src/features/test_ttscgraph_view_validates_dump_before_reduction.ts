import { loadGraph } from "@ttsc/graph";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  resolveGraphLauncher,
  resolveTtscgraphBinary,
} from "../internal/ttsgraph";

/**
 * Verifies the viewer validates native dumps before reduction or serving.
 *
 * JSON parsing alone let stale or malformed successful producers reach the
 * reducer, where they could throw an unowned JavaScript stack or be projected
 * under the wrong schema. The viewer must share the one-shot graph loader's
 * version-first, full-shape boundary.
 *
 * 1. Build one valid current dump and install a real executable fake producer.
 * 2. Return invalid JSON, schema v5, and malformed schema-v6 bodies.
 * 3. Require one owned diagnostic, non-zero exit, and no server for each.
 * 4. Return the valid dump and prove the viewer serves until explicitly stopped.
 */
export const test_ttscgraph_view_validates_dump_before_reduction =
  async (): Promise<void> => {
    const project = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "src/index.ts": "export const value = 1;\n",
    });
    const validDump = createValidDump(project);
    const parsed = JSON.parse(validDump) as {
      nodes: unknown;
      provenance: { schemaVersion: number };
    };
    const producer = createFakeProducer();
    const dumpFile = path.join(producer.root, "dump.json");

    verifyRejectedDump({
      dumpFile,
      output: "not json",
      pattern: /dump output is not valid JSON:/u,
      producer: producer.binary,
      project,
    });

    const stale = structuredClone(parsed);
    stale.provenance.schemaVersion = 5;
    verifyRejectedDump({
      dumpFile,
      output: JSON.stringify(stale),
      pattern:
        /dump is schema v5, this client reads v6[\s\S]*Install a matching `ttsc`[\s\S]*TTSC_GRAPH_BINARY/u,
      producer: producer.binary,
      project,
    });

    const malformed = structuredClone(parsed);
    malformed.nodes = null;
    verifyRejectedDump({
      dumpFile,
      output: JSON.stringify(malformed),
      pattern: /dump output does not match schema v6:[\s\S]*nodes/u,
      producer: producer.binary,
      project,
    });

    fs.writeFileSync(dumpFile, validDump, "utf8");
    const child = childProcess.spawn(
      process.execPath,
      [
        resolveGraphLauncher(),
        "view",
        "--cwd",
        project,
        "--tsconfig",
        "tsconfig.json",
        "--no-open",
        "--port",
        "0",
      ],
      {
        cwd: project,
        env: {
          ...process.env,
          TTSC_GRAPH_BINARY: producer.binary,
          TTSCGRAPH_FAKE_DUMP: dumpFile,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    child.stderr.setEncoding("utf8");
    let stderr = "";
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    try {
      await waitForViewer(child, () => stderr);
      assert.equal(child.exitCode, null, stderr);
    } finally {
      if (child.exitCode === null) child.kill();
      await waitForExit(child);
    }
  };

function createValidDump(project: string): string {
  const result = TestProject.spawn(
    resolveTtscgraphBinary(),
    ["dump", "--cwd", project, "--tsconfig", "tsconfig.json"],
    { timeout: 60_000 },
  );
  assert.equal(result.error, undefined, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  JSON.parse(result.stdout ?? "");
  return result.stdout ?? "";
}

function createFakeProducer(): { binary: string; root: string } {
  const root = TestProject.tmpdir("ttscgraph-view-dump-producer-");
  const binary = path.join(
    root,
    process.platform === "win32" ? "producer.exe" : "producer",
  );
  const source = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests",
    "test-graph",
    "src",
    "internal",
    "dumpProducerFake",
    "main.go",
  );
  const result = TestProject.spawn("go", ["build", "-o", binary, source], {
    timeout: 60_000,
  });
  assert.equal(result.error, undefined, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  return { binary, root };
}

function verifyRejectedDump(options: {
  dumpFile: string;
  output: string;
  pattern: RegExp;
  producer: string;
  project: string;
}): void {
  fs.writeFileSync(options.dumpFile, options.output, "utf8");
  const result = TestProject.spawn(
    process.execPath,
    [
      resolveGraphLauncher(),
      "view",
      "--cwd",
      options.project,
      "--tsconfig",
      "tsconfig.json",
      "--no-open",
      "--port",
      "0",
    ],
    {
      cwd: options.project,
      env: {
        TTSC_GRAPH_BINARY: options.producer,
        TTSCGRAPH_FAKE_DUMP: options.dumpFile,
      },
      timeout: 30_000,
    },
  );
  assert.equal(result.error, undefined, result.stderr);
  assert.equal(result.status, 1, result.stderr);
  const stderr = result.stderr ?? "";
  assert.match(stderr, options.pattern);
  assert.equal(
    stderr.match(/@ttsc\/graph: (?:dump output|ttscgraph dump is schema)/gu)
      ?.length,
    1,
    stderr,
  );
  assert.doesNotMatch(stderr, /serving the 3D viewer|TypeGuardError|node:/u);

  const previousDump = process.env.TTSCGRAPH_FAKE_DUMP;
  process.env.TTSCGRAPH_FAKE_DUMP = options.dumpFile;
  try {
    assert.throws(
      () =>
        loadGraph({
          binary: options.producer,
          cwd: options.project,
          tsconfig: "tsconfig.json",
        }),
      options.pattern,
    );
  } finally {
    if (previousDump === undefined) delete process.env.TTSCGRAPH_FAKE_DUMP;
    else process.env.TTSCGRAPH_FAKE_DUMP = previousDump;
  }
}

async function waitForViewer(
  child: childProcess.ChildProcess,
  stderr: () => string,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (
      /serving the 3D viewer at http:\/\/127\.0\.0\.1:\d+\//u.test(stderr())
    ) {
      return;
    }
    if (child.exitCode !== null) {
      throw new Error(
        `graph viewer exited before serving (${child.exitCode})\n${stderr()}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`graph viewer did not start within 30 seconds\n${stderr()}`);
}

async function waitForExit(child: childProcess.ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      reject(new Error("graph viewer did not stop within 10 seconds"));
    }, 10_000);
    child.once("exit", onExit);
    if (child.exitCode !== null) {
      child.off("exit", onExit);
      onExit();
    }
  });
}
