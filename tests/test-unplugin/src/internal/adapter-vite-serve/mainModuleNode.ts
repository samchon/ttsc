import assert from "node:assert/strict";

import { MAIN_URL } from "./MAIN_URL";

/** Look up the entry module's node in the server's client module graph. */
export async function mainModuleNode(server: any): Promise<any> {
  const graph = server.environments?.client?.moduleGraph ?? server.moduleGraph;
  const node = await graph.getModuleByUrl(MAIN_URL);
  assert.ok(
    node !== null && node !== undefined,
    "vite module graph must know the entry module after a request",
  );
  return node;
}
