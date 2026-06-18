import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { outputText, spawnNative } from "../../compiler/internal/spawnNative";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";

/** Format the CLI version banner from the wrapper package and resolved tsc. */
export function getCompilerVersionText(
  options: TtscCommonOptions = {},
): string {
  const tsgo = resolveTsgo(options);
  const res = spawnNative(tsgo.binary, ["--version"], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
  });
  if (res.error || res.status !== 0) {
    throw new Error(
      "ttsc.version: failed: " + (outputText(res.stderr) || res.error?.message),
    );
  }
  return `ttsc ${readOwnPackageVersion()} (${outputText(res.stdout).trim()})`;
}

/**
 * Read the `version` field from the `@ttsc/ttsc` package.json that sits three
 * directories above the compiled launcher output (`lib/launcher/internal/`).
 * Returns `"0.0.0"` on any I/O or parse failure so the banner is always safe to
 * display.
 */
function readOwnPackageVersion(): string {
  try {
    const file = path.resolve(__dirname, "..", "..", "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
