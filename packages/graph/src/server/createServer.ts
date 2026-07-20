import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import typia from "typia";

import { TtscGraphApplication, TtscGraphSource } from "../TtscGraphApplication";
import { ITtscGraphApplication } from "../structures/ITtscGraphApplication";

/**
 * Build the MCP server for a graph.
 *
 * `typia.llm.controller` reflects {@link ITtscGraphApplication} into the tool's
 * input and output schemas and its argument validator, with no hand-written
 * schema: the interface's JSDoc becomes the handshake instructions, the
 * method's becomes the tool description, and every property's becomes the
 * description of that field — including `audit`, whose JSDoc is how a caller
 * learns what the server checked before it answered.
 *
 * The registration was hand-written here for a while, because a tool that
 * declares an output schema must answer with `structuredContent` and the helper
 * also serialized the same JSON into a text block: the payload crossed the wire
 * twice, a client counted both copies against its tool-result cap, and a 30 KB
 * tour arrived as 60 KB, blew the cap, and was spilled to a file the model then
 * shelled out to read back. `@typia/mcp` 13.1.0 ships the structured result
 * once (samchon/typia#2020), so the hand-written server had nothing left to fix
 * and the library owns the registration again.
 */
export function createServer(
  graph: TtscGraphSource,
  version: string,
): McpServer {
  const server = createMcpServer(
    typia.llm.controller<ITtscGraphApplication>(
      "ttsc-graph",
      new TtscGraphApplication(graph),
    ),
  );
  // @typia/mcp 13.1.0 exposes no class-controller version option. The MCP SDK
  // keeps the initialize implementation on its public inner Server, so update
  // that already-constructed implementation before any transport connects.
  const inner = server.server as unknown as {
    _serverInfo?: { version: string };
  };
  if (inner._serverInfo === undefined) {
    throw new Error("@ttsc/graph: MCP SDK omitted the server implementation");
  }
  inner._serverInfo.version = version;
  return server;
}
