import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchSession } from "../../internal/watch";

/**
 * Verifies a real React Native JSX watch suppresses its adjacent JavaScript.
 *
 * TypeScript-Go emits `.tsx` as `.js` for `jsx: react-native`. Treating that
 * product as `.jsx` leaves the real `.js` inside the watched source directory,
 * where its creation can immediately trigger another build.
 *
 * 1. Start a real project watch without `outDir`, using a mixed-case one-dash JSX
 *    option.
 * 2. Assert tsgo writes adjacent `.js`.
 * 3. Require an idle period with no self-triggered rebuild.
 */
export const test_ttsc_watch_ignores_react_native_adjacent_javascript =
  async (): Promise<void> => {
    const root = TestProject.commonJsProject(
      {
        "src/view.tsx": "export const view = 1;\n",
      },
      {
        compilerOptions: {
          jsx: "react-native",
          outDir: undefined,
          rootDir: undefined,
        },
      },
    );
    const session = new WatchSession(root, {
      args: ["-JSX", "react-native"],
    });
    try {
      await session.waitForBuilds(1);
      assert.equal(
        fs.existsSync(path.join(root, "src", "view.js")),
        true,
        session.transcript(),
      );
      await session.waitForQuiet();
    } finally {
      await session.close();
    }
  };
