import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";

/**
 * Write the language server's plugin manifest to a private file the Go host can
 * read.
 *
 * The file lives in its own canonical temporary directory, is created
 * exclusively with owner-only permissions, and is removed by `dispose`, so a
 * second server or another user on the machine can neither read nor replace the
 * selection this server made.
 */
export function materializeLSPPluginManifest(manifest: unknown): {
  dispose(): void;
  path: string;
} {
  const directory = createCanonicalTempDirectory("ttsc-lsp-");
  const location = path.join(directory, "plugins.json");
  try {
    fs.writeFileSync(location, JSON.stringify(manifest), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    fs.rmSync(directory, { force: true, recursive: true });
    throw error;
  }
  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      fs.rmSync(directory, { force: true, recursive: true });
    },
    path: location,
  };
}
