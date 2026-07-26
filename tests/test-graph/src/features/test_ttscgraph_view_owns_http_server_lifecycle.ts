import { TestProject } from "@ttsc/testing";
import childProcess from "node:child_process";
import http from "node:http";
import net from "node:net";

import {
  assert,
  resolveGraphLauncher,
  resolveTtscgraphBinary,
} from "../internal/ttsgraph";

/**
 * Verifies the graph viewer owns its asynchronous HTTP server lifecycle.
 *
 * A valid but occupied port fails after the synchronous launcher has returned.
 * Without an `error` listener, Node prints an unhandled EventEmitter stack and
 * chooses the process status instead of the graph CLI. The correction must not
 * disturb a successful long-lived viewer or its three bundled assets.
 *
 * 1. Bind a real localhost server to an ephemeral port.
 * 2. Launch the real graph viewer against that occupied port.
 * 3. Assert one actionable package diagnostic, explicit failure status, and no
 *    unhandled-event stack before releasing the fixture server.
 * 4. Launch the viewer on port zero and request every served asset.
 * 5. Prove it remains alive until the test explicitly stops it.
 */
export const test_ttscgraph_view_owns_http_server_lifecycle =
  async (): Promise<void> => {
    const root = TestProject.createProject({
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
    const occupied = net.createServer();
    await new Promise<void>((resolve, reject) => {
      occupied.once("error", reject);
      occupied.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = occupied.address();
      assert.ok(address && typeof address === "object");
      const result = TestProject.spawn(
        process.execPath,
        [
          resolveGraphLauncher(),
          "view",
          "--cwd",
          root,
          "--tsconfig",
          "tsconfig.json",
          "--no-open",
          "--port",
          String(address.port),
        ],
        {
          env: { TTSC_GRAPH_BINARY: resolveTtscgraphBinary() },
          timeout: 60_000,
        },
      );
      assert.equal(result.error, undefined, result.stderr);
      assert.equal(result.status, 1, result.stderr);
      const stderr = result.stderr ?? "";
      assert.equal(
        stderr.match(/@ttsc\/graph: could not serve/g)?.length,
        1,
        stderr,
      );
      assert.match(stderr, new RegExp(`127\\.0\\.0\\.1:${address.port}`));
      assert.match(stderr, /EADDRINUSE|address already in use/iu);
      assert.doesNotMatch(
        stderr,
        /Unhandled 'error' event|Emitted 'error' event|node:events/iu,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        occupied.close((error) => (error ? reject(error) : resolve()));
      });
    }

    const child = childProcess.spawn(
      process.execPath,
      [
        resolveGraphLauncher(),
        "view",
        "--cwd",
        root,
        "--tsconfig",
        "tsconfig.json",
        "--no-open",
        "--port",
        "0",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          TTSC_GRAPH_BINARY: resolveTtscgraphBinary(),
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
      const url = await waitForViewerUrl(child, () => stderr);
      const [index, viewer, graph] = await Promise.all([
        request(`${url}`),
        request(`${url}viewer.js`),
        request(`${url}graph.json`),
      ]);
      assert.equal(index.status, 200);
      assert.match(index.body, /<!doctype html>/iu);
      assert.equal(viewer.status, 200);
      assert.match(viewer.contentType, /^application\/javascript\b/iu);
      assert.ok(viewer.body.length > 1_000);
      assert.equal(graph.status, 200);
      assert.match(graph.contentType, /^application\/json\b/iu);
      const payload = JSON.parse(graph.body) as {
        links?: unknown[];
        nodes?: unknown[];
      };
      assert.ok(Array.isArray(payload.nodes));
      assert.ok(Array.isArray(payload.links));
      assert.equal(child.exitCode, null, stderr);
    } finally {
      if (child.exitCode === null) {
        child.kill();
      }
      await waitForExit(child);
    }
  };

async function waitForViewerUrl(
  child: childProcess.ChildProcess,
  stderr: () => string,
): Promise<string> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const match = stderr().match(
      /serving the 3D viewer at (http:\/\/127\.0\.0\.1:\d+\/)/u,
    );
    if (match) return match[1]!;
    if (child.exitCode !== null) {
      throw new Error(
        `graph viewer exited before serving (${child.exitCode})\n${stderr()}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`graph viewer did not start within 60 seconds\n${stderr()}`);
}

async function request(url: string): Promise<{
  body: string;
  contentType: string;
  status?: number;
}> {
  return new Promise((resolve, reject) => {
    const outgoing = http.get(url, (response) => {
      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({
          body,
          contentType: String(response.headers["content-type"] ?? ""),
          status: response.statusCode,
        });
      });
    });
    outgoing.on("error", reject);
  });
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
