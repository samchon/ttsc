import assert from "node:assert/strict";

import { MAIN_URL } from "./MAIN_URL";
import { waitForViteWatchRegistration } from "./waitForViteWatchRegistration";

/** Transform the entry module through the dev server and return its code. */
export async function requestMainModule(server: any): Promise<string> {
  const result = await server.transformRequest(MAIN_URL);
  assert.ok(
    result !== null &&
      result !== undefined &&
      typeof result.code === "string" &&
      result.code.length !== 0,
    `vite serve must answer the entry module request with transformed code; received: ${JSON.stringify(result)}`,
  );
  await waitForViteWatchRegistration(server);
  return result.code;
}
