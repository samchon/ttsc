import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the CommonJS compatibility correction leaves ESM builtins intact.
 *
 * ESM imports of `node:sqlite` already resolve successfully on affected Node
 * releases. The ttsx resolve hook must preserve that native ESM path while it
 * corrects only the stripped CommonJS result.
 *
 * 1. Create an ESM project whose entry imports and uses `node:sqlite`.
 * 2. Run the entry through the real ttsx launcher.
 * 3. Assert the database opens, closes, and reaches the success marker.
 */
export const test_ttsx_esm_keeps_prefix_only_node_builtin_imports = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ type: "module" }),
    "tsconfig.json": TestProject.tsconfig({
      target: "ES2022",
      module: "ES2022",
      moduleResolution: "bundler",
      strict: true,
      outDir: "dist",
      rootDir: "src",
    }),
    "src/node-sqlite.d.ts": `
      declare module "node:sqlite" {
        export class DatabaseSync {
          constructor(location: string);
          close(): void;
        }
      }
    `,
    "src/main.ts": `
      import { DatabaseSync } from "node:sqlite";
      const database = new DatabaseSync(":memory:");
      database.close();
      console.log("esm-sqlite-ok");
    `,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "esm-sqlite-ok");
};
