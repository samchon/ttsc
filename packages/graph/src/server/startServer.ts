import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TtscGraphSession } from "../model/TtscGraphSession";
import { createServer } from "./createServer";

/**
 * Serve the graph tools over MCP on stdio. The server answers the MCP handshake
 * immediately and opens the resident incremental graph session on the first
 * real tool call, so a large project cannot make the client give up before
 * tools are advertised and an escape request still performs no graph work.
 *
 * The transport and stdin end events close any lazily created native session.
 *
 * @evidence contracts/common.md#principled-implementation A lazy provider opens the resident graph on demand while the stdio MCP transport advertises tools independently of index creation.
 * @evidence contracts/common.md#clear-and-simple-design This boundary owns transport wiring and session lifetime; createServer owns reflected tools and the session owns native snapshots.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An escape request does not trigger a forced graph build or a fabricated empty graph response.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains lazy indexing and shutdown ownership; option comments specify project coordinates and handshake version.
 * @evidence contracts/portability.md#os-neutral-implementation The stdio transport and native session abstracts process handling across hosts; cwd and tsconfig are passed as project coordinates without shell interpolation.
 * @evidence contracts/performance.md#efficient-algorithms Startup registers one tool and transport without scanning the project; index work occurs only when the provider is requested.
 * @evidence contracts/performance.md#reuse-equivalent-work One resident session is shared by all tool calls for the selected project and refreshes its generation before use.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The server owns at most one session; transport close or stdin end releases its child processes and pending requests.
 */
export async function startServer(options: {
  /** Project working directory, defaulting to the process directory. */
  cwd?: string;

  /**
   * Configuration path interpreted relative to cwd, defaulting to
   * tsconfig.json.
   */
  tsconfig?: string;

  /** Server version reported in the MCP handshake. */
  version: string;
}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const tsconfig = options.tsconfig ?? "tsconfig.json";
  let session: TtscGraphSession | undefined;
  const server = createServer(async () => {
    if (closed) throw new Error("@ttsc/graph: server is closed");
    session ??= new TtscGraphSession({ cwd, tsconfig });
    return session.graph();
  }, options.version);
  const transport = new StdioServerTransport();
  let closed = false;
  const closeSession = () => {
    if (closed) return;
    closed = true;
    void session?.close().catch((error: unknown) => {
      process.stderr.write(`@ttsc/graph: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
  };
  transport.onclose = closeSession;
  process.stdin.once("end", closeSession);
  await server.connect(transport);
}
