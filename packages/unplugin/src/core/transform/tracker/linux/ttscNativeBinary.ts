import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * The ttsc native binary the compile runs, or `undefined` when there is none
 * (samchon/ttsc#1426).
 *
 * Resolved the way `ttsc` resolves its own: an absolute `TTSC_BINARY`, then the
 * platform package `@ttsc/<platform>-<arch>` beside the `ttsc` package this
 * adapter resolves, then the `ttsc-native` binary of the repository's own
 * layout. The Linux watch helper is a command of that binary, so the helper and
 * the compile always come from one build.
 */
export function ttscNativeBinary(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (env.TTSC_BINARY !== undefined && path.isAbsolute(env.TTSC_BINARY)) {
    return env.TTSC_BINARY;
  }
  let manifest: string;
  try {
    manifest = fs.realpathSync(
      createRequire(import.meta.url).resolve("ttsc/package.json"),
    );
  } catch {
    return undefined;
  }
  const windows = process.platform === "win32";
  try {
    return createRequire(manifest).resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/${windows ? "ttsc.exe" : "ttsc"}`,
    );
  } catch {
    // The repository's own layout below.
  }
  const local = path.resolve(
    path.dirname(manifest),
    "..",
    "native",
    windows ? "ttsc-native.exe" : "ttsc-native",
  );
  return fs.existsSync(local) ? local : undefined;
}
