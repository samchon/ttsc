import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import typia, { type IValidation } from "typia";

import { TtscGraphApplication, TtscGraphSource } from "../TtscGraphApplication";
import { ITtscGraphApplication } from "../structures/ITtscGraphApplication";

/**
 * Build the MCP server for a graph. `typia.llm.application` reflects
 * {@link ITtscGraphApplication} into the tool's input and output schemas and its
 * argument validator (no hand-written schema): the class JSDoc becomes the
 * handshake instructions, the method's becomes the tool description, and every
 * property's becomes the description of that field — including `integrity`,
 * whose JSDoc is how a caller learns what the number the server audits means.
 *
 * The registration is written here rather than taken from `@typia/mcp`'s
 * `createMcpServer` for one reason: a tool that declares an output schema must
 * answer with `structuredContent`, and that helper also serializes the same
 * JSON into a text block, so the result crosses the wire twice. A client counts
 * both copies against its tool-result cap — a 30 KB tour arrives as 60 KB,
 * blows the cap, and is spilled to a file the model then shells out to read
 * back. This server answers with the structured result alone: the schema is
 * advertised, the payload crosses once.
 */
export function createServer(graph: TtscGraphSource, version: string): Server {
  const application = typia.llm.application<ITtscGraphApplication>();
  const [tool] = application.functions;
  if (tool === undefined) throw new Error("no graph tool was reflected");
  const execute = new TtscGraphApplication(graph);

  const server = new Server(
    { name: "ttsc-graph", version },
    {
      capabilities: { tools: {} },
      instructions: application.description,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: tool.name,
        description: tool.description,
        inputSchema: objectSchema(tool.parameters),
        ...(tool.output !== undefined
          ? { outputSchema: objectSchema(tool.output) }
          : {}),
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== tool.name) {
      return errorResult(`Unknown tool: ${request.params.name}`);
    }
    const validation: IValidation<ITtscGraphApplication.IProps> =
      typia.validate<ITtscGraphApplication.IProps>(
        request.params.arguments ?? {},
      );
    if (!validation.success) {
      // A validation failure is the model's to fix, so hand back the errors it
      // needs to fix them rather than a protocol error it cannot see.
      return errorResult(JSON.stringify(validation.errors));
    }
    const output = await execute.inspect_typescript_graph(validation.data);
    return { content: [], structuredContent: output };
  });

  return server;
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/** The JSON Schema of a reflected parameter or return object. */
function objectSchema(schema: {
  properties: Record<string, unknown>;
  required?: string[];
  $defs?: Record<string, unknown>;
}) {
  return {
    type: "object" as const,
    properties: schema.properties,
    required: schema.required,
    additionalProperties: false,
    $defs: schema.$defs,
  };
}
