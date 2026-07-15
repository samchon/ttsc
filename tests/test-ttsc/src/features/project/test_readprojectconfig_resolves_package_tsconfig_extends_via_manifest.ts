import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  readProjectConfig,
} from "../../internal/project";

/**
 * Verifies readProjectConfig resolves package tsconfig extends via
 * package.json#tsconfig.
 *
 * A bare `extends` specifier may name an npm preset that selects its config
 * file through `package.json#tsconfig` and ships no JavaScript/JSON entrypoint.
 * Node's entrypoint resolver and the `<specifier>.json` fallback both miss such
 * a package, so `readProjectConfig` must honor the manifest field the way
 * `tsc` does, or a TypeScript-valid project fails before native compilation.
 *
 * 1. Create `node_modules/example-preset` whose `package.json` has only a
 *    `tsconfig` field (no `main`/`exports`) pointing at `base.json`.
 * 2. Write a project tsconfig that extends the bare `"example-preset"`.
 * 3. Assert the inherited plugins and absolute `outDir` come from the
 *    manifest-selected `base.json`.
 */
export const test_readprojectconfig_resolves_package_tsconfig_extends_via_manifest =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const preset = path.join(root, "node_modules", "example-preset");
    const project = path.join(root, "project");
    fs.mkdirSync(preset, { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(preset, "package.json"),
      JSON.stringify(
        { name: "example-preset", version: "1.0.0", tsconfig: "base.json" },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(preset, "base.json"),
      JSON.stringify(
        {
          compilerOptions: {
            outDir: "../../dist/preset",
            plugins: [{ transform: "./plugins/from-preset.cjs" }],
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify(
        { extends: "example-preset", compilerOptions: {} },
        null,
        2,
      ),
      "utf8",
    );

    const parsed = readProjectConfig({
      tsconfig: path.join(project, "tsconfig.json"),
    });
    assert.deepEqual(parsed.compilerOptions.plugins, [
      { transform: "./plugins/from-preset.cjs" },
    ]);
    assert.equal(
      parsed.compilerOptions.outDir,
      path.join(root, "dist", "preset"),
    );
  };
