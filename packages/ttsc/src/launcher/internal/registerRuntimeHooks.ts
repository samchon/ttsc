import path from "node:path";
import { pathToFileURL } from "node:url";

import { entryModuleFormat, installRuntimeHooks } from "./runtimeHooks";

/**
 * Bootstrap `ttsx` spawns as the child's main module: it installs the runtime
 * module hooks, then loads the TypeScript entry _from source_.
 *
 * Why load the entry here instead of passing it as Node's main entry: a
 * CommonJS `require("./x")` chain only reaches `module.registerHooks` when the
 * entry itself is loaded through a CommonJS `require`. Running the `.ts` as
 * Node's ESM-first main entry leaves inner `require`s on the native loader,
 * where they cannot resolve a sibling `.ts`. So the parent invokes `node
 * registerRuntimeHooks.js <entry> [argv...]` and we `require()` (or dynamically
 * `import()`) the entry after the hooks are live.
 *
 * `process.argv` is rewritten to `[node, <entry>, ...argv]` so the program sees
 * the same argv it would under a direct `node <entry>` invocation.
 */
const entry = process.argv[2];
if (entry === undefined) {
  process.stderr.write("ttsx: internal error — no entry passed to bootstrap\n");
  process.exit(2);
}

const forwarded = process.argv.slice(3);
process.argv = [process.argv[0]!, entry, ...forwarded];

installRuntimeHooks();

const kind = entryModuleFormat(path.resolve(entry));

function fail(error: unknown): never {
  // Match Node's own uncaught-exception surfacing for a thrown entry error.
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
}

// A genuine dynamic `import()`. Authored directly it would be downlevelled to a
// `require()` shim under this package's CommonJS emit, which cannot load a
// `file:` URL or an ESM module — so build it through `Function` to keep it an
// `import` at runtime.
const dynamicImport = new Function(
  "specifier",
  "return import(specifier);",
) as (specifier: string) => Promise<unknown>;

if (kind === "module") {
  dynamicImport(pathToFileURL(path.resolve(entry)).href).catch(fail);
} else {
  try {
    require(path.resolve(entry));
  } catch (error) {
    fail(error);
  }
}
