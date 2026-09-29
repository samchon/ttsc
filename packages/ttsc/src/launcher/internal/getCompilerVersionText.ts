import fs from "node:fs";
import path from "node:path";

import { outputText } from "../../compiler/internal/outputText";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { spawnNative } from "../../compiler/internal/spawnNative";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";

/**
 * Format the CLI version banner from the wrapper package and resolved tsc. A
 * failed native version request throws; unreadable wrapper metadata uses
 * 0.0.0.
 *
 * @evidence contracts/common.md#principled-implementation The resolved compiler's version command supplies compiler identity, while package-local metadata supplies wrapper identity with a documented fallback.
 * @evidence contracts/common.md#clear-and-simple-design Native invocation and wrapper metadata reading have separate failure policies; the private reader owns only the package-relative lookup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback is an explicit unknown wrapper version, not a fabricated compiler version or a suppressed failed native command.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents the distinct native-command failure and metadata fallback, and the helper explains the compiled-layout anchor.
 * @evidence contracts/portability.md#os-neutral-implementation resolveTsgo and spawnNative own executable selection and invocation; shared environment merging preserves Windows alias identity and caller precedence while POSIX names remain exact. Node paths anchor package metadata without a shell or filesystem case folding.
 */
export function getCompilerVersionText(
  options: TtscCommonOptions = {},
): string {
  const tsgo = resolveTsgo(options);
  const res = spawnNative(tsgo.binary, ["--version"], {
    cwd: options.cwd,
    env: SidecarEnvironment.merge(process.env, options.env),
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
    return typeof pkg?.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}
