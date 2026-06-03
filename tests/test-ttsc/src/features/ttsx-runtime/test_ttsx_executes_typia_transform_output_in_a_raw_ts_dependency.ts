import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import { goPath } from "../../internal/plugin-corpus";

/**
 * Verifies ttsx executes typia transform output inside a raw `.ts` dependency.
 *
 * The entry project imports a dependency that ships TypeScript sources and
 * calls `typia.createIs<T>()`. That dependency is compiled lazily by the
 * runtime dependency hook, so typia must be auto-discovered and run in the
 * dependency build, not only in the entry compile gate. Without the transform,
 * typia's runtime rejects the uncompiled `createIs<T>()` call.
 *
 * 1. Link the workspace-installed typia package into a synthetic project.
 * 2. Run ttsx against an entry importing a raw-`.ts` dependency that uses typia.
 * 3. Assert the validator accepts valid input and rejects invalid input
 *    (`true:false`) — output only a real `createIs` transform produces, since an
 *    untransformed call throws typia's no-transform error at runtime.
 */
export const test_ttsx_executes_typia_transform_output_in_a_raw_ts_dependency =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/typed-dep/package.json": JSON.stringify({
        name: "typed-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
        dependencies: { typia: "*" },
      }),
      "node_modules/typed-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/typed-dep/src/index.ts":
        `import typia from "typia";\n` +
        `interface User {\n` +
        `  id: string;\n` +
        `  age: number;\n` +
        `  tags: string[];\n` +
        `}\n` +
        `const isUser = typia.createIs<User>();\n` +
        `export const verdict = (): string => [\n` +
        `  isUser({ id: "user-1", age: 42, tags: ["admin"] }),\n` +
        `  isUser({ id: "user-2", age: "bad", tags: ["admin"] }),\n` +
        `].join(":");\n`,
      "src/main.ts": `import { verdict } from "typed-dep";\nconsole.log(verdict());\n`,
    });
    fs.symlinkSync(
      installedTypiaRoot(),
      path.join(root, "node_modules", "typia"),
      "junction",
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "true:false");
  };

function installedTypiaRoot(): string {
  const requireFromWebsite = createRequire(
    path.join(TestProject.WORKSPACE_ROOT, "website", "package.json"),
  );
  return path.dirname(requireFromWebsite.resolve("typia/package.json"));
}
