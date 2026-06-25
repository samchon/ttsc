import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadGraph } from "../model/loadGraph";
import { createServer } from "./createServer";

/** How to build and serve the graph for a project. */
export interface ServeOptions {
  cwd?: string;
  tsconfig?: string;
  /** Server version reported in the MCP handshake. */
  version: string;
}

/**
 * Build the project's resident graph and serve it over MCP on stdio. This is
 * the default `ttsc-graph` invocation an agent's MCP client spawns: `ttscgraph
 * dump` runs once to produce the checker-resolved fact graph, then the
 * in-memory server answers every tool call until stdin closes.
 */
export async function startServer(options: ServeOptions): Promise<void> {
  const graph = loadGraph({ cwd: options.cwd, tsconfig: options.tsconfig });
  const server = createServer(graph, options.version);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
