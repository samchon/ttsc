import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `ttsx` resolves a _computed_ dynamic `import()` of a `.ts` sibling
 * inside a raw-`.ts` dependency.
 *
 * The dependency module keeps its source `.ts` identity, so a computed
 * `import(`./plugins/${name}.ts`)` resolves beside the source — where
 * `plugins/beta.ts` lives — and `load` serves its compiled JavaScript. The
 * resolve hook must accept the concrete `.ts` specifier at the source rather
 * than failing it; a regression would crash with `ERR_MODULE_NOT_FOUND`.
 *
 * 1. Install a `dyn-dep` whose `index.ts` computes `./plugins/${which}.ts` and
 *    dynamically imports it.
 * 2. Run `ttsx` against an entry that awaits the dependency.
 * 3. Assert the dynamically-imported plugin's value printed.
 */
export const test_ttsx_resolves_a_computed_typescript_dynamic_import_in_a_dependency =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/dyn-dep/package.json": JSON.stringify({
        name: "dyn-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/dyn-dep/index.ts":
        `export const load = async (): Promise<string> => {\n` +
        `  const which = "beta";\n` +
        `  const mod = await import(\`./plugins/\${which}.ts\`);\n` +
        `  return (mod as { value: string }).value;\n` +
        `};\n`,
      "node_modules/dyn-dep/plugins/beta.ts": `export const value: string = "plugin-beta";\n`,
      "src/main.ts": `import { load } from "dyn-dep";\nconsole.log(await load());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "plugin-beta");
  };
