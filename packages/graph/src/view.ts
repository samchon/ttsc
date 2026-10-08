import fs from "node:fs";
import http from "node:http";
import type { Socket } from "node:net";
import path from "node:path";

import { TtscGraphLauncherArguments } from "./TtscGraphLauncherArguments";
import { TtscGraphViewSnapshot } from "./TtscGraphViewSnapshot";
import { GraphProcessTrace } from "./internal/GraphProcessTrace";
import { publishArtifacts } from "./model/publishedArtifacts";
import { captureProcessOutput, ensureExecutable } from "./nativeExecutable";
import { reduce } from "./reduce";
import { resolveGraphBinary } from "./resolveGraphBinary";

/**
 * `ttsc-graph view`: build the project's code graph, reduce it, and serve a
 * self-contained 3D viewer on a localhost port, opening the browser. The native
 * binary produces the graph (the same `dump` the docs document); everything
 * else is local and offline. The process stays alive serving until Ctrl+C.
 *
 * @evidence contracts/common.md#principled-implementation Loopback binding must succeed before native preparation starts. Only a version-validated, reduced snapshot and bundled assets become ready; requests during preparation receive 503.
 * @evidence contracts/common.md#clear-and-simple-design CLI parsing, native capture, reduction and loopback serving have explicit boundaries; browser opening is a best-effort convenience.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native failure remains a nonzero outcome and viewer absence remains an installation error rather than a fallback to fabricated graph data.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains offline operation, native producer responsibility and the process lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation Binary selection and Node paths/fs use native abstractions; browser opening isolates Windows start, macOS open and other-host xdg-open commands.
 * @evidence contracts/performance.md#efficient-algorithms Native capture and reduction process the dump once; JSON and viewer assets are materialized once and reused by HTTP responses.
 * @evidence contracts/performance.md#reuse-equivalent-work All requests to this one-shot viewer share the same reduced graph string and asset buffers; a new source snapshot requires another viewer invocation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Capture descriptors are disposed in finally. Signal cancellation cancels scheduled preparation or publication, drops the payload and closes owned sockets/server; bind failure releases signal listeners without starting native work. Synchronous native preparation cannot be interrupted by a queued JavaScript signal handler.
 */
export function runView(argv: readonly string[]): number | void {
  const opts = TtscGraphLauncherArguments.view(argv);

  // Anchor binary resolution at the project selected by `--cwd`, so `view` from
  // an unrelated directory still finds the `ttsc` installed under the target.
  const binary = resolveGraphBinary(process.env, opts.cwd);
  if (binary === null) {
    process.stderr.write(
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
        "Install `ttsc` so its platform package is present, " +
        "or set TTSC_GRAPH_BINARY to an absolute path.\n",
    );
    return 1;
  }
  ensureExecutable(binary);

  let prepared: Exclude<ReturnType<typeof prepareView>, number> | undefined;
  let state: "binding" | "preparing" | "ready" | "closing" | "closed" =
    "binding";
  let pending: NodeJS.Immediate | undefined;
  let closeRequested = false;
  let endpoint = `127.0.0.1:${opts.port}`;
  const connections = new Set<Socket>();
  const server = http.createServer((req, res) => {
    if (state !== "ready" || prepared === undefined) {
      res.writeHead(503, {
        "content-type": "text/plain; charset=utf-8",
        connection: "close",
      });
      res.end("The graph viewer is not ready.\n");
      return;
    }
    const url = (req.url ?? "/").split("?")[0];
    if (url === "/graph.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(prepared.graphJson);
    } else if (url === "/viewer.js") {
      res.writeHead(200, {
        "content-type": "application/javascript; charset=utf-8",
      });
      res.end(prepared.viewerJs);
    } else {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(prepared.indexHtml);
    }
  });
  const releaseSignals = (): void => {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
  };
  const reportCloseFailure = (error: Error): void => {
    process.exitCode = 1;
    process.stderr.write(
      `@ttsc/graph: could not close the 3D viewer at ${endpoint} (${error.message}).\n`,
    );
  };
  const stop = (): void => {
    if (state === "closed") return;
    state = "closing";
    if (pending !== undefined) {
      clearImmediate(pending);
      pending = undefined;
    }
    prepared = undefined;
    for (const connection of connections) connection.destroy();
    // If cancellation preceded the listening event, that event owns closure.
    if (!server.listening || closeRequested) return;
    closeRequested = true;
    try {
      server.close((error) => {
        if (error) reportCloseFailure(error);
      });
    } catch (error) {
      reportCloseFailure(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };
  const interrupt = (): void => {
    process.exitCode = 130;
    stop();
  };
  const terminate = (): void => {
    process.exitCode = 143;
    stop();
  };
  server.on("connection", (connection) => {
    connections.add(connection);
    connection.once("close", () => connections.delete(connection));
    if (state === "closing" || state === "closed") connection.destroy();
  });
  server.once("close", () => {
    if (pending !== undefined) {
      clearImmediate(pending);
      pending = undefined;
    }
    state = "closed";
    prepared = undefined;
    releaseSignals();
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    const detail =
      typeof error.code === "string"
        ? `${error.code}: ${error.message}`
        : error.message;
    process.stderr.write(
      `@ttsc/graph: could not serve the 3D viewer at ${endpoint} (${detail}).\n`,
    );
    process.exitCode = 1;
    if (!server.listening && !closeRequested) {
      state = "closed";
      if (pending !== undefined) {
        clearImmediate(pending);
        pending = undefined;
      }
      prepared = undefined;
      releaseSignals();
    } else stop();
  });
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    server.listen(opts.port, "127.0.0.1", () => {
      if (state === "closing") {
        stop();
        return;
      }
      if (state !== "binding") return;
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : opts.port;
      endpoint = `127.0.0.1:${port}`;
      state = "preparing";
      pending = setImmediate(() => {
        pending = undefined;
        if (state !== "preparing") return;
        try {
          const result = prepareView(opts, binary);
          if (typeof result === "number") {
            process.exitCode = result;
            stop();
            return;
          }
          // Yield after synchronous native preparation so queued cancellation
          // and transport events are handled before publishing readiness.
          pending = setImmediate(() => {
            pending = undefined;
            if (state !== "preparing") return;
            prepared = result;
            state = "ready";
            const counts = result.payload.counts;
            const url = `http://${endpoint}/`;
            process.stderr.write(
              `@ttsc/graph: ${counts.nodes.toLocaleString()} nodes / ${counts.links.toLocaleString()} edges` +
                ` (from ${counts.rawNodes.toLocaleString()} / ${counts.rawEdges.toLocaleString()})\n`,
            );
            process.stderr.write(
              `@ttsc/graph: serving the 3D viewer at ${url}\n`,
            );
            process.stderr.write("@ttsc/graph: press Ctrl+C to stop.\n");
            if (opts.open) openBrowser(url);
          });
        } catch (error) {
          process.stderr.write(
            `@ttsc/graph: could not prepare the 3D viewer (${String(error)}).\n`,
          );
          process.exitCode = 1;
          stop();
        }
      });
    });
  } catch (error) {
    state = "closed";
    releaseSignals();
    throw error;
  }
}

/** Prepare one validated native snapshot and its bundled viewer assets. */
function prepareView(
  opts: ReturnType<typeof TtscGraphLauncherArguments.view>,
  binary: string,
) {
  process.stderr.write(
    `@ttsc/graph: building the graph for ${opts.cwd} (${opts.tsconfig})...\n`,
  );
  // The dump goes to a file rather than a pipe, so no output ceiling applies.
  const capture = captureProcessOutput();
  let dump;
  let dumpStdout: string;
  let dumpStderr: string;
  try {
    // The same artifacts the dump, the loader, and the resident session ask
    // for. Without this the viewer draws a different graph from the one every
    // other entry point answers with, and it already carries the colours for
    // the nodes it would be missing.
    const artifacts = publishArtifacts({
      cwd: opts.cwd,
      tsconfig: opts.tsconfig,
    });
    dump = GraphProcessTrace.spawnSync(
      binary,
      [
        "dump",
        "--cwd",
        opts.cwd,
        "--tsconfig",
        opts.tsconfig,
        ...(artifacts.file === null ? [] : ["--artifacts", artifacts.file]),
      ],
      {
        stdio: ["ignore", capture.stdoutFd, capture.stderrFd],
        windowsHide: true,
      },
    );
    dumpStdout = capture.read("stdout");
    dumpStderr = capture.read("stderr");
  } finally {
    capture.dispose();
  }
  if (dump.error) {
    process.stderr.write(`@ttsc/graph: ${dump.error.message}\n`);
    return 1;
  }
  if (dump.status !== 0) {
    process.stderr.write(dumpStderr || "@ttsc/graph: dump failed\n");
    return dump.status ?? 1;
  }

  const snapshot = TtscGraphViewSnapshot.decode(dumpStdout);
  if (!snapshot.ok) {
    process.stderr.write(snapshot.diagnostic);
    return snapshot.code;
  }

  const payload = reduce(snapshot.raw, { maxNodes: opts.maxNodes });
  payload.project = path.basename(path.resolve(opts.cwd));
  const graphJson = JSON.stringify(payload);

  const viewerDir = path.join(__dirname, "viewer");
  let indexHtml: Buffer;
  let viewerJs: Buffer;
  try {
    indexHtml = fs.readFileSync(path.join(viewerDir, "index.html"));
    viewerJs = fs.readFileSync(path.join(viewerDir, "viewer.js"));
  } catch (err) {
    process.stderr.write(
      `@ttsc/graph: the bundled viewer is missing (${String(err)}). ` +
        "Reinstall @ttsc/graph.\n",
    );
    return 1;
  }

  return { payload, graphJson, indexHtml, viewerJs };
}

/** Best-effort open the URL in the default browser; the URL is printed anyway. */
function openBrowser(url: string): void {
  try {
    if (process.platform === "win32")
      GraphProcessTrace.spawn("cmd", ["/c", "start", "", url], {
        stdio: "ignore",
        detached: true,
        windowsHide: true,
      })
        .on("error", () => undefined)
        .unref();
    else if (process.platform === "darwin")
      GraphProcessTrace.spawn("open", [url], {
        stdio: "ignore",
        detached: true,
      })
        .on("error", () => undefined)
        .unref();
    else
      GraphProcessTrace.spawn("xdg-open", [url], {
        stdio: "ignore",
        detached: true,
      })
        .on("error", () => undefined)
        .unref();
  } catch {
    /* the URL is printed; opening is a convenience */
  }
}
