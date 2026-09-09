import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies orphan decorator stack traces retain source positions after caching.
 *
 * Decorator helpers move emitted lines. The isolated emit and its persistent
 * cache must retain an inline map whose path belongs to this exact source.
 *
 * 1. Load equivalent throwing decorated dependencies from two project paths.
 * 2. Execute each twice through one cache root.
 * 3. Assert every stack points to the original method line in its own project.
 */
export const test_ttsx_standard_decorator_orphan_maps_survive_cached_runs =
  () => {
    const cacheDir = TestProject.tmpdir("ttsx-decorator-maps-");
    for (const type of ["module", "module", "commonjs", "commonjs"]) {
      const root = TestProject.createProject({
        "package.json": '{"type":"module"}',
        "tsconfig.json": TestProject.tsconfig({
          target: "ES2022",
          module: "esnext",
          rootDir: "src",
          outDir: "dist",
        }),
        "src/main.ts":
          'const name: string = "dep"; const dep = await import(name); dep.run(); export {};',
        "node_modules/dep/package.json": JSON.stringify({
          name: "dep",
          type,
          exports: "./index.ts",
        }),
        "node_modules/dep/index.ts": [
          'export * from "./values";',
          "function decorated(value: Function, context: ClassDecoratorContext) {}",
          "@decorated",
          "class Foo {",
          "  run() {",
          '    throw new Error("decorator-map");',
          "  }",
          "}",
          "export const run = () => new Foo().run();",
        ].join("\n"),
        "node_modules/dep/values.ts": "export const value = 1;",
      });
      for (let i = 0; i < 2; i++) {
        const result = TestProject.spawn(
          TestProject.TTSX_BIN,
          ["src/main.ts"],
          { cwd: root, env: { TTSC_CACHE_DIR: cacheDir } },
        );
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Error: decorator-map/);
        assert.ok(
          result.stderr
            .replaceAll("\\", "/")
            .includes(
              path
                .join(root, "node_modules/dep/index.ts")
                .replaceAll("\\", "/") + ":6:",
            ),
          result.stderr,
        );
      }
    }
  };
