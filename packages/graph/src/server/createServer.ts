import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import typia from "typia";

import { TtscGraphApplication } from "../TtscGraphApplication";
import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphApplication } from "../structures/ITtscGraphApplication";
import { instructions } from "./instructions";

/**
 * Build the MCP server for a graph. `typia.llm.controller` reflects
 * {@link ITtscGraphApplication} into a validated tool application — every tool's
 * JSON schema and argument validator is generated from the method's TypeScript
 * types and JSDoc, so there is no hand-written schema. The list/call handlers
 * below are the minimal standalone registration: list the generated functions,
 * and on a call validate the arguments (returning typia's errors for the model
 * to self-correct) before invoking the method.
 *
 * Registration is inlined rather than pulled from `@typia/mcp` to keep the
 * dependency surface to `typia` plus the MCP SDK and avoid version-pinning the
 * wider typia ecosystem; the shape it relies on is `typia.llm.controller`'s
 * public output.
 */
export function createServer(
  graph: TtscGraphMemory,
  version: string,
): McpServer {
  const controller = typia.llm.controller<ITtscGraphApplication>(
    "graph",
    new TtscGraphApplication(graph),
  );
  const functions = controller.application.functions;
  const execute = controller.execute as unknown as Record<
    string,
    (input: unknown) => unknown
  >;

  const server = new McpServer(
    { name: "ttsc-graph", version },
    { capabilities: { tools: {} }, instructions },
  );
  const raw = server.server;

  raw.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: functions.map((func) => ({
      name: func.name,
      description: func.description,
      inputSchema: {
        type: "object" as const,
        properties: func.parameters.properties,
        required: func.parameters.required,
        additionalProperties: false,
        $defs: func.parameters.$defs,
      },
    })),
  }));

  raw.setRequestHandler(CallToolRequestSchema, async (request) => {
    const func = functions.find((f) => f.name === request.params.name);
    const method = execute[request.params.name];
    if (func === undefined || method === undefined) {
      return error(`Unknown tool: ${request.params.name}`);
    }
    // A client may omit `arguments` for an all-optional tool (e.g. graph_overview);
    // validate an empty object so that call succeeds instead of failing on "expected object".
    const validation = func.validate(request.params.arguments ?? {});
    if (!validation.success) {
      // Hand typia's validation errors back so the model can correct its call.
      return error(JSON.stringify(validation.errors, null, 2));
    }
    try {
      const result = await method.call(execute, validation.data);
      return {
        content: [
          {
            type: "text" as const,
            text:
              result === undefined
                ? "Success"
                : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (exception) {
      return error(
        exception instanceof Error
          ? `${exception.name}: ${exception.message}`
          : String(exception),
      );
    }
  });

  return server;
}

function error(text: string): {
  isError: true;
  content: { type: "text"; text: string }[];
} {
  return { isError: true, content: [{ type: "text", text }] };
}
