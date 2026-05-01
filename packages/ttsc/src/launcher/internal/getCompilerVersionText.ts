import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";

/** Format the CLI version banner from the wrapper package and resolved tsgo. */
export function getCompilerVersionText(
  options: TtscCommonOptions = {},
): string {
  const tsgo = resolveTsgo(options);
  const res = spawnSync(tsgo.binary, ["--version"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16,
    windowsHide: true,
  });
  if (res.error || res.status !== 0) {
    throw new Error(
      "ttsc.version: failed: " +
        (outputText(res.stderr) || res.error?.message),
    );
  }
  return `ttsc ${readOwnPackageVersion()} (${outputText(res.stdout).trim()})`;
}

function outputText(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}

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
