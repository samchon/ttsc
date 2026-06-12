import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  copyProject,
  fs,
  goPath,
  path,
  spawn,
  ttsxBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx rebuilds a dependency emit cache when runtime
 * code generates a new source under that dependency's tsconfig.
 *
 * A test runner can generate a source file, import it, then generate another
 * file in the same project. The first import builds the dependency cache before
 * the second file exists. The second import must not reuse that stale "done"
 * marker and then fall back to untransformed TypeScript; it has to rebuild the
 * dependency so its configured transform plugin still runs.
 *
 * 1. Copy the `go-source-plugin` fixture under `node_modules/plugin-dep`.
 * 2. The entry writes and requires `first.ts`, then writes and requires
 *    `second.ts` in the dependency's `src/` directory.
 * 3. Assert both values were transformed by the dependency's plugin.
 */
export const test_plugin_corpus_ttsx_rebuilds_dependency_cache_for_runtime_generated_source =
  () => {
    const root = commonJsProject({
      "src/main.ts": [
        `declare const console: { log(message: string): void };`,
        `declare const process: { cwd(): string };`,
        `declare function require<T = unknown>(name: string): T;`,
        `const fs = require<{`,
        `  mkdirSync(p: string, o: { recursive: boolean }): void;`,
        `  writeFileSync(p: string, data: string): void;`,
        `}>("node:fs");`,
        `const path = require<{ join(...parts: string[]): string }>(`,
        `  "node:path",`,
        `);`,
        `const depDir = path.join(`,
        `  process.cwd(),`,
        `  "node_modules",`,
        `  "plugin-dep",`,
        `  "src",`,
        `);`,
        `fs.mkdirSync(depDir, { recursive: true });`,
        `const load = (name: string): string => {`,
        `  fs.writeFileSync(`,
        `    path.join(depDir, name + ".ts"),`,
        `    'export const value: string = goUpper("' + name + '");\\n',`,
        `  );`,
        `  return require<{ value: string }>(path.join(depDir, name + ".ts"))`,
        `    .value;`,
        `};`,
        `console.log(load("first") + ":" + load("second"));`,
        ``,
      ].join("\n"),
    });
    const depRoot = path.join(root, "node_modules", "plugin-dep");
    fs.mkdirSync(path.dirname(depRoot), { recursive: true });
    fs.cpSync(copyProject("go-source-plugin"), depRoot, { recursive: true });
    fs.writeFileSync(
      path.join(depRoot, "package.json"),
      JSON.stringify({
        name: "plugin-dep",
        version: "1.0.0",
        main: "src/main.ts",
      }),
    );

    const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "FIRST:SECOND");
  };
