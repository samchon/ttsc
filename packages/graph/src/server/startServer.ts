import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { TtscGraphSession } from "../model/TtscGraphSession";
import { createServer } from "./createServer";

/**
 * Serve the graph tools over MCP on stdio. The server answers the MCP handshake
 * immediately and opens the resident incremental graph session on the first
 * real tool call, so a large project cannot make the client give up before
 * tools are advertised and an escape request still performs no graph work.
 */
export async function startServer(options: {
  cwd?: string;
  tsconfig?: string;
  /** Server version reported in the MCP handshake. */
  version: string;
}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const tsconfig = options.tsconfig ?? "tsconfig.json";
  let session: TtscGraphSession | undefined;
  const server = createServer(async () => {
    session ??= new TtscGraphSession({ cwd, tsconfig });
    return session.graph();
  }, options.version);
  const transport = new StdioServerTransport();
  const closeSession = () => session?.close();
  transport.onclose = closeSession;
  process.stdin.once("end", closeSession);
  await server.connect(transport);
}
