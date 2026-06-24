import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtsgraphClient, assert, spawnDaemon } from "../internal/ttsgraph";

interface ToolResult {
  content: { type: string; text: string }[];
}

/**
 * Verifies the build-once daemon plus `--connect` proxy serves real MCP
 * sessions: one resident Program answers a session driven through a separate
 * proxy process, not just the in-process stdio server.
 *
 * The stdio case pins the single-process pipeline; this case pins the
 * large-repository primitive instead — a long-lived `--daemon` builds the
 * checker once, publishes its loopback address to a port file, and a transient
 * `--connect <addr>` proxy pipes an agent's stdio to that warm daemon. The same
 * observable nodes/diagnostics text must come back through the two-process hop,
 * proving the daemon's TCP listener and the proxy's stdio bridge both work.
 *
 * 1. Materialize a project with a heritage edge (Sub extends Base) and a type
 *    error, spawn the daemon, and poll its port file for the loopback address.
 * 2. Drive initialize, tools/list, and tools/call for query_nodes and
 *    query_diagnostics through a `--connect` proxy at that address.
 * 3. Assert the node heritage relation and the TS2322 diagnostic, then kill the
 *    daemon and remove the port file.
 */
export const test_ttscgraph_daemon_serves_via_connect_proxy = async () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
        },
        files: ["src/main.ts"],
      },
      null,
      2,
    ),
    "src/base.ts": "export class Base {}\n",
    "src/main.ts": [
      'import { Base } from "./base";',
      "export class Sub extends Base {}",
      'export const bad: number = "not a number";',
      "",
    ].join("\n"),
  });

  const portFile = path.join(TestProject.tmpdir("ttscgraph-daemon-"), "port");
  const daemon = spawnDaemon(root, portFile);
  let daemonStderr = "";
  daemon.stderr.setEncoding("utf8");
  daemon.stderr.on("data", (chunk: string) => {
    daemonStderr += chunk;
  });
  let daemonExit: number | null = null;
  daemon.on("exit", (code) => {
    daemonExit = code ?? 0;
  });

  try {
    const addr = await pollPortFile(portFile, () => ({
      exited: daemonExit !== null,
      stderr: daemonStderr,
    }));

    const client = TtsgraphClient.connect(addr);
    try {
      const init = (await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
      })) as { serverInfo?: { name?: string } };
      assert.equal(
        init.serverInfo?.name,
        "ttsc-graph",
        "initialize returns the server name through the proxy",
      );
      client.notify("notifications/initialized", {});

      const list = (await client.request("tools/list", {})) as {
        tools: { name: string }[];
      };
      const names = list.tools.map((tool) => tool.name);
      assert.ok(
        names.includes("query_nodes") &&
          names.includes("query_files") &&
          names.includes("query_diagnostics"),
        `tools/list advertises the graph tools, got ${names.join(", ")}`,
      );

      const explore = (await client.request("tools/call", {
        name: "query_nodes",
        arguments: { query: "Sub" },
      })) as ToolResult;
      const exploreText = explore.content[0]?.text ?? "";
      assert.ok(
        exploreText.includes("Sub") &&
          exploreText.includes("Base") &&
          exploreText.includes("heritage"),
        `query_nodes renders the Sub -> Base heritage relation:\n${exploreText}`,
      );

      const diagnostics = (await client.request("tools/call", {
        name: "query_diagnostics",
        arguments: { files: ["src/main.ts"] },
      })) as ToolResult;
      const diagnosticsText = diagnostics.content[0]?.text ?? "";
      assert.ok(
        diagnosticsText.includes("TS2322"),
        `query_diagnostics surfaces the TS2322 type error:\n${diagnosticsText}`,
      );
    } finally {
      client.endStdin();
    }

    const code = await client.waitForExit();
    assert.equal(
      code,
      0,
      `the --connect proxy should exit cleanly on stdin close\nstderr: ${client.stderrText()}`,
    );
  } finally {
    if (daemonExit === null) daemon.kill();
    try {
      fs.rmSync(portFile, { force: true });
    } catch {
      /* port file may already be gone if the daemon removed it on shutdown */
    }
  }
};

/**
 * Poll `portFile` until the daemon publishes its `host:port` address. The
 * daemon writes the file shortly after spawn, so an absent or empty file is a
 * normal early state; abort only if the daemon dies or the timeout elapses.
 */
async function pollPortFile(
  portFile: string,
  probe: () => { exited: boolean; stderr: string },
  timeoutMs = 30_000,
  intervalMs = 50,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { exited, stderr } = probe();
    if (exited) {
      throw new Error(
        `ttscgraph daemon exited before serving\nstderr: ${stderr}`,
      );
    }
    let contents = "";
    try {
      contents = fs.readFileSync(portFile, "utf8").trim();
    } catch {
      contents = "";
    }
    if (contents.includes(":")) return contents;
    if (Date.now() > deadline) {
      throw new Error(
        `ttscgraph daemon did not publish a port within ${timeoutMs}ms\nstderr: ${stderr}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
