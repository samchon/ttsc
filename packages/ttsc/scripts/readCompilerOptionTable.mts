import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { CompilerOptionSpec } from "../src/flags/CompilerOptionSpec.ts";

type NativeOption = CompilerOptionSpec & { readonly alias?: string };

/**
 * Read parser metadata through the existing shims of both compiler targets:
 * this SDK's go.mod for TypeScript 7.0 and the go.7.1.work workspace for 7.1.
 * The launcher runs before a project's compiler line is known, so its table is
 * the union of the two; an option either target spells differently is an
 * error. Development generation/checks require a runnable Go tool on PATH; they
 * fail when that oracle cannot run. CLI runtime reads only the generated table.
 * Module files remain read-only.
 */
export function readCompilerOptionTable(): {
  readonly options: ReadonlyMap<string, CompilerOptionSpec>;
  readonly asciiFolds: ReadonlyMap<string, string>;
  readonly enumWhitespace: ReadonlySet<string>;
} {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const targets = [
    readNativeTable(root, { GOWORK: "off" }),
    readNativeTable(root, {
      GOWORK: path.resolve(root, "../../go.7.1.work"),
      GOFLAGS: [process.env.GOFLAGS, "-tags=ttsc_typescript_7_1"].filter(Boolean).join(" "),
    }),
  ];
  const options = new Map<string, CompilerOptionSpec>();
  const asciiFolds = new Map<string, string>();
  const enumWhitespace = new Set<string>();
  for (const native of targets) {
    for (const [from, to] of Object.entries(native.asciiFolds)) {
      if (asciiFolds.has(from) && asciiFolds.get(from) !== to)
        throw new Error(`Conflicting native ASCII fold: ${from}.`);
      asciiFolds.set(from, to);
    }
    for (const name of native.enumWhitespace) enumWhitespace.add(name);
  }
  for (const entry of targets.flatMap((native) => native.options)) {
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
  return { options, asciiFolds, enumWhitespace };
}

/** Run the native option oracle under one compiler target's environment. */
function readNativeTable(
  root: string,
  env: Record<string, string>,
): {
  options: NativeOption[];
  asciiFolds: Record<string, string>;
  enumWhitespace: string[];
} {
  const result = spawnSync("go", ["run", "-mod=readonly", "./scripts/compiler-options"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, ...env },
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(`Native compiler option metadata failed: ${result.stderr}`);
  const native = JSON.parse(result.stdout);
  if (!Array.isArray(native.options) || native.options.length === 0)
    throw new Error("Native compiler option metadata is empty.");
  return native;
}
