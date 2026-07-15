import { TestProject } from "@ttsc/testing";

import { assert, fs, path, readProjectConfig } from "../../internal/project";

/**
 * Verifies readProjectConfig fails visibly when a package.json#tsconfig target
 * is missing.
 *
 * The manifest-preset resolution must stay a resolution of TypeScript's
 * accepted contract, not a silent best-effort: when a preset declares a
 * `tsconfig` field whose file does not exist, the core reader owns config
 * diagnostics and must throw rather than fall back to Node entrypoint
 * resolution and hide the misconfiguration. This is the negative twin of the
 * successful manifest-selected resolution.
 *
 * 1. Create `node_modules/broken-preset` whose `package.json#tsconfig` points at
 *    a non-existent `missing.json`.
 * 2. Write a project tsconfig that extends the bare `"broken-preset"`.
 * 3. Assert `readProjectConfig` throws about the unresolved extended tsconfig.
 */
export const test_readprojectconfig_rejects_missing_package_tsconfig_manifest_target =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const preset = path.join(root, "node_modules", "broken-preset");
    const project = path.join(root, "project");
    fs.mkdirSync(preset, { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(preset, "package.json"),
      JSON.stringify(
        { name: "broken-preset", version: "1.0.0", tsconfig: "missing.json" },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify(
        { extends: "broken-preset", compilerOptions: {} },
        null,
        2,
      ),
      "utf8",
    );

    assert.throws(
      () =>
        readProjectConfig({
          tsconfig: path.join(project, "tsconfig.json"),
        }),
      /extended tsconfig not found|missing\.json/,
    );
  };
