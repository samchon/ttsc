import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createLinkedWorkspaceFixture } from "../../internal/adapter-vite-serve/createLinkedWorkspaceFixture";
import { mainModuleNode } from "../../internal/adapter-vite-serve/mainModuleNode";
import { requestMainModule } from "../../internal/adapter-vite-serve/requestMainModule";
import { startViteServer } from "../../internal/adapter-vite-serve/startViteServer";

/**
 * Verifies creating a file outside every recorded predicate does not invalidate
 * a served module.
 *
 * This is the negative twin of candidate tracking. A new file that no recorded
 * compiler observation names, placed outside the project root, must leave the
 * cached transform in place, even across several intervals of the fallback
 * poll.
 *
 * 1. Start a dev server and request the entry module.
 * 2. Create an unrelated TypeScript file beside the project, outside its root.
 * 3. Wait several fallback poll intervals.
 * 4. Assert the entry module's cached transform is still present.
 */
export async function test_vite_serve_ignores_an_unrelated_missing_file_creation(): Promise<void> {
  const fixture = createLinkedWorkspaceFixture();
  const server = await startViteServer(fixture);
  try {
    await requestMainModule(server);
    const node = await mainModuleNode(server);
    assert.ok(
      node.transformResult !== null && node.transformResult !== undefined,
      "the first request must leave a cached transform on the module node",
    );

    fs.writeFileSync(
      // Keep this outside the project root. A new included source under
      // `src` changes the compiler's recorded project-membership listing
      // and must invalidate; this case is the negative twin that proves a
      // creation outside every recorded predicate does not.
      path.join(path.dirname(fixture.app), "unrelated.ts"),
      "export const unrelated: number = 1;\n",
      "utf8",
    );
    // Several multiples of the 500ms poll interval: long enough for a
    // wrongly registered poller to have fired.
    await new Promise((resolve) => setTimeout(resolve, 1_600));
    assert.ok(
      node.transformResult !== null && node.transformResult !== undefined,
      "an unrelated file creation must not invalidate the entry module",
    );
  } finally {
    await server.close();
  }
}
