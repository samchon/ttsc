import assert from "node:assert/strict";

import type { IDeliveryPassSession } from "./IDeliveryPassSession";

/** Deliver every module of the session inside one pass. */
export async function deliverPass(
  session: IDeliveryPassSession,
): Promise<void> {
  session.pass();
  for (const file of session.modules) {
    assert.ok(await session.deliver(file), `expected output for ${file}`);
  }
}
