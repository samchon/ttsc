import { TestProject } from "@ttsc/testing";
import nodeChildProcessForTrace from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { FixtureFiles } from "../../../internal/FixtureFiles";
import { installedTargetBoundary } from "../../../internal/graph/internal/installedTargetBoundary";
import {
  assert,
  resolveGraphLauncher,
  resolveTtscgraphBinary,
} from "../../../internal/graph/internal/ttsgraph";

const childProcess = { ...nodeChildProcessForTrace, ...E2eProcessTrace };

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
 *
 * @evidence contracts/testing.md#behavioral-verification The workspace-built viewer rejects an occupied localhost port with one owned diagnostic, then a separate port-zero viewer stays alive while index, viewer script and graph JSON return correct statuses and content types.
 * @evidence contracts/testing.md#independent-expectations An actual occupying server and literal HTTP/status/content-type/diagnostic assertions independently require real binding behavior; script length checks asset delivery without asserting its complete contents.
 * @evidence contracts/testing.md#distinguishing-cases Port conflict contrasts successful ephemeral binding; three routes share one live viewer, and unhandled stack/error duplication must be absent.
 * @evidence contracts/testing.md#execution-ownership The selected Graph DAG calls this body on its upfront tools/graph-http island. Two workspace-built viewer processes use the selected actual native binary and HTTP/dump boundaries; this is not a packed graph SDK installation or source-unit route call.
 * @evidence contracts/e2e.md#necessary-boundary Native dump loading, bundled assets and a real HTTP listening socket must assemble through the CLI; direct reducer or route calls cannot certify binding and process lifetime.
 * @evidence contracts/e2e.md#shared-execution Both launches borrow the authored target-layout project also used by empty-artifact discovery and resident lifetime checks, but explicitly select the workspace native binary rather than proving target-installed native resolution. Occupied and successful server states still require two viewer lifetimes; all three assets and readiness/alive assertions share the successful viewer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original viewer config temporarily applies and restores after owned server/child cleanup; operation, socket-cleanup and config-reset failures are collected together. Ephemeral ports avoid conflicts; the occupying socket receives a close attempt even when initial listen setup fails, and the successful viewer is killed and its process/stdio close joined before reuse. An unjoined child retains its project and blocks dependent reuse; restoration failure also blocks reuse. Startup/exit deadlines remain sixty/ten seconds and HTTP responses own a ten-second deadline with error/abort rejection.
 * @evidence contracts/e2e.md#preserved-coverage Original status-one/error-count/stack exclusions, URL observation, three HTTP routes, asset length, arrays and live-child checks remain. This genuine native success also retains the removed canned-dump viewer readiness, alive-until-stop and joined-exit assertions; malformed dump schema/diagnostic/code controls remain at the actual generated viewer decoder owner.
 */
export const case_ttscgraph_view_owns_http_server_lifecycle =
  async (prepared?: {
    root: string;
    retainUnjoined(reason: string): void;
    preventReuse(reason: string): void;
  }): Promise<void> => {
    const target = prepared ?? installedTargetBoundary();
    const root = target.root;
    const configFile = path.join(root, "tsconfig.json");
    const original = fs.readFileSync(configFile);
    const failures: unknown[] = [];
    let joined = true;
    try {
      fs.writeFileSync(
        configFile,
        FixtureFiles.read(
          "graph/ttscgraph_view_owns_http_server_lifecycle/inputs-1",
        )["tsconfig.json"]!,
      );
      const occupied = net.createServer();
      try {
        await new Promise<void>((resolve, reject) => {
          occupied.once("error", reject);
          occupied.listen(0, "127.0.0.1", resolve);
        });
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
        if (result.error || result.signal !== null || result.status === null) {
          joined = false;
          target.retainUnjoined(
            "occupied-port graph viewer has no actual process closure acknowledgement",
          );
          throw new Error(
            "occupied-port graph viewer closure remained unresolved",
            { cause: result.error },
          );
        }
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
          /@ttsc\/graph: building the graph|@ttsc\/graph: serving the 3D viewer/iu,
          "binding refusal must precede native preparation and readiness",
        );
        assert.doesNotMatch(
          stderr,
          /Unhandled 'error' event|Emitted 'error' event|node:events/iu,
        );
      } catch (error) {
        failures.push(error);
      } finally {
        await new Promise<void>((resolve, reject) => {
          occupied.close((error) => (error ? reject(error) : resolve()));
        }).catch((error) => {
          failures.push(error);
        });
      }

      if (!joined)
        throw new Error(
          "graph viewer inputs remain owned by an unresolved process",
        );
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
      let spawnFailure: Error | undefined;
      child.once("error", (error) => {
        spawnFailure = error;
      });
      const closed = new Promise<void>((resolve) =>
        child.once("close", () => resolve()),
      );
      child.stdout.resume();
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      try {
        const url = await waitForViewerUrl(
          child,
          () => stderr,
          () => spawnFailure,
        );
        const replies = await Promise.allSettled([
          request(`${url}`),
          request(`${url}viewer.js`),
          request(`${url}graph.json`),
        ]);
        for (const [index, reply] of replies.entries()) {
          try {
            if (reply.status === "rejected") throw reply.reason;
            const result = reply.value;
            assert.equal(result.status, 200);
            if (index === 0) assert.match(result.body, /<!doctype html>/iu);
            else if (index === 1) {
              assert.match(result.contentType, /^application\/javascript\b/iu);
              assert.ok(result.body.length > 1_000);
            } else {
              assert.match(result.contentType, /^application\/json\b/iu);
              const payload = JSON.parse(result.body) as {
                links?: unknown[];
                nodes?: unknown[];
              };
              assert.ok(Array.isArray(payload.nodes));
              assert.ok(Array.isArray(payload.links));
            }
          } catch (error) {
            failures.push(
              new Error(["index", "viewer.js", "graph.json"][index], {
                cause: error,
              }),
            );
          }
        }
        assert.equal(child.exitCode, null, stderr);
      } catch (error) {
        failures.push(error);
      } finally {
        if (child.exitCode === null) {
          try {
            child.kill();
          } catch (error) {
            failures.push(error);
          }
        }
        await waitForExit(closed).catch((error) => {
          joined = false;
          failures.push(error);
          try {
            target.retainUnjoined(
              "Graph viewer child exit was not established",
            );
          } catch (retentionError) {
            failures.push(retentionError);
          }
        });
      }
    } catch (error) {
      failures.push(error);
    } finally {
      if (joined) {
        try {
          fs.writeFileSync(configFile, original);
        } catch (error) {
          failures.push(error);
          target.preventReuse("Viewer profile config restoration failed");
        }
      }
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "Graph viewer lifetime assertions failed",
      );
  };

async function waitForViewerUrl(
  child: childProcess.ChildProcess,
  stderr: () => string,
  spawnFailure: () => Error | undefined,
): Promise<string> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const failure = spawnFailure();
    if (failure !== undefined) throw failure;
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
      response.once("error", reject);
      response.once("aborted", () =>
        reject(new Error(`Viewer response aborted: ${url}`)),
      );
    });
    outgoing.on("error", reject);
    outgoing.setTimeout(10_000, () =>
      outgoing.destroy(new Error(`Viewer response timed out: ${url}`)),
    );
  });
}

async function waitForExit(closed: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      closed,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error("graph viewer did not stop within 10 seconds")),
          10_000,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
