import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { CompilerOptionSpec } from "../src/flags/CompilerOptionSpec.ts";

type NativeOption = CompilerOptionSpec & { readonly alias?: string };

/**
 * Read parser metadata through the existing shim and this SDK's go.mod.
 * Development generation/checks require a runnable Go tool on PATH; they fail
 * when that oracle cannot run. CLI runtime reads only the generated table.
 * Ambient workspaces are disabled and module files remain read-only.
 */
export function readCompilerOptionTable(): {
  readonly options: ReadonlyMap<string, CompilerOptionSpec>;
  readonly asciiFolds: ReadonlyMap<string, string>;
  readonly enumWhitespace: ReadonlySet<string>;
} {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = spawnSync("go", ["run", "-mod=readonly", "./scripts/compiler-options/main.go"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GOWORK: "off" },
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(`Native compiler option metadata failed: ${result.stderr}`);
  const native = JSON.parse(result.stdout) as {
    options: NativeOption[];
    asciiFolds: Record<string, string>;
    enumWhitespace: string[];
  };
  if (!Array.isArray(native.options) || native.options.length === 0)
    throw new Error("Native compiler option metadata is empty.");
  const options = new Map<string, CompilerOptionSpec>();
  for (const entry of native.options) {
    const { alias, ...option } = entry;
    if (
      !/^[\x00-\x7f]+$/.test(option.name) ||
      (alias !== undefined && !/^[\x00-\x7f]+$/.test(alias))
    )
      throw new Error("Native option names exceeded the ASCII case domain.");
    if (
      !["boolean", "string", "number", "enum", "list", "object"].includes(option.kind) ||
      (option.kind === "object" && !option.configOnly) ||
      (option.kind === "list" &&
        !option.configOnly &&
        option.element !== "string" &&
        option.element !== "enum")
    )
      throw new Error(`Unsupported native option grammar: ${option.name}.`);
    for (const spelling of [option.name, ...(alias === undefined ? [] : [alias])]) {
      const key = spelling.toLowerCase();
      const previous = options.get(key);
      if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(option))
        throw new Error(`Conflicting native compiler option identity: ${key}.`);
      options.set(key, option);
    }
  }
  return {
    options,
    asciiFolds: new Map(Object.entries(native.asciiFolds)),
    enumWhitespace: new Set(native.enumWhitespace),
  };
}
