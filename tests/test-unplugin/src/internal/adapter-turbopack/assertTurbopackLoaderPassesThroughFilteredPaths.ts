import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { runTurbopackLoader } from "./runTurbopackLoader";

/**
 * Asserts the loader's own filter: declaration files and `node_modules` paths
 * pass through byte-for-byte. A broad `*.ts` rule glob routes everything with
 * the extension through the loader, so the loader must mirror the unplugin
 * adapters' `transformInclude` guard itself.
 */
export async function assertTurbopackLoaderPassesThroughFilteredPaths(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const declaration = "declare const ambient: number;\n";
  const declarationOut = await runTurbopackLoader({
    resourcePath: path.join(root, "src", "ambient.d.ts"),
    source: declaration,
  });
  assert.equal(declarationOut, declaration);

  const vendored = 'export const value: string = goUpper("plugin");\n';
  const vendoredOut = await runTurbopackLoader({
    resourcePath: path.join(root, "node_modules", "pkg", "main.ts"),
    source: vendored,
  });
  assert.equal(vendoredOut, vendored);
}
