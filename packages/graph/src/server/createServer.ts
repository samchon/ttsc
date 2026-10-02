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
 * description of that field — including `audit`, whose JSDoc explains fact
 * provenance and coverage without claiming a second compiler check.
 *
 * The library owns registration and sends structured results once by default.
 * Its version option identifies this graph server in the handshake without
 * changing SDK internals after construction.
 *
 * @evidence contracts/common.md#principled-implementation The typed controller supplies reflected schemas and executor dispatch; the supported version option sets the MCP implementation identity at construction.
 * @evidence contracts/common.md#clear-and-simple-design The integration delegates registration and result serialization to the library instead of maintaining another transport implementation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Handshake version uses the public createMcpServer option; no SDK private field or foreign method is patched.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain schema/JSDoc reflection, structured-result ownership and public version configuration.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources createServer returns a server whose lifetime its caller owns and retains nothing itself.
 * @evidenceExclude contracts/performance.md#efficient-algorithms createServer makes a bounded pass over its arguments and chooses no algorithm or data structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work createServer computes its value from its arguments on each call and shares no completed or in-flight work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation createServer operates on in-memory values and performs no filesystem, path or process operation.
 */
export function createServer(
  graph: TtscGraphSource,
  version: string,
): McpServer {
  return createMcpServer(
    typia.llm.controller<ITtscGraphApplication>(
      "ttsc-graph",
      new TtscGraphApplication(graph),
    ),
    { version },
  );
}
