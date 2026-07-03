import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import typia, { type ILlmController } from "typia";

import { TtscGraphApplication, TtscGraphSource } from "../TtscGraphApplication";
import { ITtscGraphApplication } from "../structures/ITtscGraphApplication";

/**
 * Build the MCP server for a graph. `typia.llm.application` reflects
 * {@link ITtscGraphApplication} into the tool schema and validator (no
 * hand-written schema), and `createMcpServer` from `@typia/mcp` handles the
 * list/call registration, argument validation, and structured output.
 *
 * We assemble the `ILlmController` (`{ protocol, name, application, execute }`)
 * directly rather than via `typia.llm.controller` so the server is named
 * "ttsc-graph" on our terms, not coupled to a reflected class name. Handshake
 * instructions come from the class JSDoc; the single tool is named from its
 * method, `inspect_typescript_graph`.
 */
export function createServer(
  graph: TtscGraphSource,
  version: string,
): McpServer {
  const controller: ILlmController<ITtscGraphApplication> = {
    protocol: "class",
    name: "ttsc-graph",
    application: typia.llm.application<ITtscGraphApplication>(),
    execute: new TtscGraphApplication(graph),
  };
  return createMcpServer(controller, version);
}
