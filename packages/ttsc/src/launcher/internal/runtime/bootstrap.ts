import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Child-process main that loads the entry through the right module system so
 * the runtime hooks (installed by the `--import` registrar) cover every reach.
 *
 * A CommonJS entry must be loaded with `require`: dynamic `import()` of a CJS
 * module routes through the ESM→CJS translator, whose internal `require` does
 * not pass relative specifiers through `registerHooks`, so `require("./foo")`
 * would not find `./foo.ts`. An ESM entry is loaded with `import()`.
 *
 * The entry path and the user program's argv arrive through the environment so
 * Node sees this bootstrap as the main; `process.argv` is rewritten to what the
 * entry expects (`[node, entry, ...args]`).
 */
const entry = process.env["TTSX_ENTRY"] ?? "";
const argv: string[] = parseArgv(process.env["TTSX_ARGV"]);
process.argv = [process.argv[0]!, entry, ...argv];

if (entry === "") {
  process.stderr.write("ttsx: no entry to run\n");
  process.exit(2);
}

if (isCommonJs(entry)) {
  createRequire(pathToFileURL(entry).href)(entry);
} else {
  import(pathToFileURL(entry).href).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}

function parseArgv(raw: string | undefined): string[] {
  if (raw === undefined || raw === "") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Whether Node treats the entry as CommonJS: `.cts`, or `.ts` in a CJS package. */
function isCommonJs(file: string): boolean {
  if (file.endsWith(".mts")) {
    return false;
  }
  if (file.endsWith(".cts")) {
    return true;
  }
  return nearestPackageType(file) !== "module";
}

function nearestPackageType(file: string): "module" | "commonjs" {
  let dir = path.dirname(file);
  for (;;) {
    const manifest = path.join(dir, "package.json");
    if (fileExists(manifest)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
          type?: string;
        };
        return parsed.type === "module" ? "module" : "commonjs";
      } catch {
        return "commonjs";
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return "commonjs";
    }
    dir = parent;
  }
}

function fileExists(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}
