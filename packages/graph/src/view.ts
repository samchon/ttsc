import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { ensureExecutable } from "./nativeExecutable";
import { type RawDump, reduce } from "./reduce";
import { resolveGraphBinary } from "./resolveGraphBinary";

interface ViewOptions {
  cwd: string;
  tsconfig: string;
  port: number;
  open: boolean;
  maxNodes: number;
}

function parseViewArgs(argv: readonly string[]): ViewOptions {
  const opts: ViewOptions = {
    cwd: process.cwd(),
    tsconfig: "tsconfig.json",
    port: 0,
    open: true,
    maxNodes: 1200,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--cwd") opts.cwd = argv[++i] ?? opts.cwd;
    else if (arg.startsWith("--cwd=")) opts.cwd = arg.slice("--cwd=".length);
    else if (arg === "--tsconfig" || arg === "-p")
      opts.tsconfig = argv[++i] ?? opts.tsconfig;
    else if (arg.startsWith("--tsconfig="))
      opts.tsconfig = arg.slice("--tsconfig=".length);
    else if (arg === "--port") opts.port = Number(argv[++i]);
    else if (arg.startsWith("--port="))
      opts.port = Number(arg.slice("--port=".length));
    else if (arg === "--no-open") opts.open = false;
    else if (arg === "--max-nodes") opts.maxNodes = Number(argv[++i]);
    else if (arg.startsWith("--max-nodes="))
      opts.maxNodes = Number(arg.slice("--max-nodes=".length));
  }
  return opts;
}

/**
 * `ttsc-graph view`: build the project's code graph, reduce it, and serve a
 * self-contained 3D viewer on a localhost port, opening the browser. The native
 * binary produces the graph (the same `dump` the docs document); everything
 * else is local and offline. The process stays alive serving until Ctrl+C.
 */
export function runView(argv: readonly string[]): number | void {
  const opts = parseViewArgs(argv);

  const binary = resolveGraphBinary();
  if (binary === null) {
    process.stderr.write(
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
        "Install `ttsc` so its platform package is present, " +
        "or set TTSC_GRAPH_BINARY to an absolute path.\n",
    );
    return 1;
  }
  ensureExecutable(binary);

  process.stderr.write(
    `@ttsc/graph: building the graph for ${opts.cwd} (${opts.tsconfig})...\n`,
  );
  const dump = spawnSync(
    binary,
    ["dump", "--cwd", opts.cwd, "--tsconfig", opts.tsconfig],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 },
  );
  if (dump.error) {
    process.stderr.write(`@ttsc/graph: ${dump.error.message}\n`);
    return 1;
  }
  if (dump.status !== 0) {
    process.stderr.write(dump.stderr || "@ttsc/graph: dump failed\n");
    return dump.status ?? 1;
  }

  let raw: RawDump;
  try {
    raw = JSON.parse(dump.stdout) as RawDump;
  } catch (err) {
    process.stderr.write(
      `@ttsc/graph: could not parse the graph dump: ${String(err)}\n`,
    );
    return 1;
  }

  const payload = reduce(raw, { maxNodes: opts.maxNodes });
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

  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    if (url === "/graph.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(graphJson);
    } else if (url === "/viewer.js") {
      res.writeHead(200, {
        "content-type": "application/javascript; charset=utf-8",
      });
      res.end(viewerJs);
    } else {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(indexHtml);
    }
  });

  server.listen(opts.port, "127.0.0.1", () => {
    const address = server.address();
    const port =
      typeof address === "object" && address ? address.port : opts.port;
    const url = `http://127.0.0.1:${port}/`;
    const counts = payload.counts;
    process.stderr.write(
      `@ttsc/graph: ${counts.nodes.toLocaleString()} nodes / ${counts.links.toLocaleString()} edges` +
        ` (from ${counts.rawNodes.toLocaleString()} / ${counts.rawEdges.toLocaleString()})\n`,
    );
    process.stderr.write(`@ttsc/graph: serving the 3D viewer at ${url}\n`);
    process.stderr.write("@ttsc/graph: press Ctrl+C to stop.\n");
    if (opts.open) openBrowser(url);
  });
  // No return: the listening server keeps the process alive until Ctrl+C.
}

/** Best-effort open the URL in the default browser; the URL is printed anyway. */
function openBrowser(url: string): void {
  try {
    if (process.platform === "win32")
      spawn("cmd", ["/c", "start", "", url], {
        stdio: "ignore",
        detached: true,
      }).unref();
    else if (process.platform === "darwin")
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    else spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* the URL is printed; opening is a convenience */
  }
}
