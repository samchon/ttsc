import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the dependency asset rescue still surfaces `ERR_MODULE_NOT_FOUND`
 * for an asset that genuinely does not exist.
 *
 * The hook maps a dependency's failed relative asset import back onto its
 * source tree, but only when the mapped file exists; a missing asset must still
 * fail rather than resolve to nothing. A static missing import is caught at the
 * compile gate (`TS2307`), so a _computed_ dynamic import is used to reach the
 * runtime existence gate — the negative twin of the co-located-asset rescue.
 *
 * 1. Install a `dyn-asset` whose `.ts` computes a missing `./ghost.json` and
 *    dynamically imports it.
 * 2. Run `ttsx` against an entry that awaits the dependency.
 * 3. Assert a non-zero exit carrying `ERR_MODULE_NOT_FOUND`, nothing printed.
 */
export const test_ttsx_preserves_module_not_found_for_a_missing_asset_in_a_dependency =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          resolveJsonModule: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/dyn-asset/package.json": JSON.stringify({
        name: "dyn-asset",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/dyn-asset/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          resolveJsonModule: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/dyn-asset/src/index.ts":
        `export const read = async (): Promise<string> => {\n` +
        `  const name = "ghost";\n` +
        `  const mod = await import(\`./\${name}.json\`, { with: { type: "json" } });\n` +
        `  return (mod.default as { label: string }).label;\n` +
        `};\n`,
      "src/main.ts": `import { read } from "dyn-asset";\nconsole.log(await read());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(result.status, 0, "a missing asset must fail the run");
    assert.equal(result.stdout.trim(), "");
    assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
  };
