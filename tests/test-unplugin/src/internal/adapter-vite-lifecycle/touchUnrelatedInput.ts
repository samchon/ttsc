import fs from "node:fs";

import type { IViteAdapterSession } from "./IViteAdapterSession";

/** Change a project input that every module's validation covers. */
export function touchUnrelatedInput(session: IViteAdapterSession): void {
  fs.appendFileSync(
    session.unrelatedInput,
    "\n// changed after the session's generation was captured\n",
    "utf8",
  );
}
