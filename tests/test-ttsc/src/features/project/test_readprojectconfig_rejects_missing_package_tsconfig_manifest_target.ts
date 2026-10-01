import { TestProject } from "../../../../utils/src/TestProject";

import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

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
 * 1. Create `node_modules/broken-preset` whose `package.json#tsconfig` points at a
 *    non-existent `missing.json`.
 * 2. Write a project tsconfig that extends the bare `"broken-preset"`.
 * 3. Assert `readProjectConfig` throws about the unresolved extended tsconfig.
 *
 * @evidence contracts/testing.md#behavioral-verification Resolves a preset whose manifest names an absent config and requires a missing-extended-config error rather than a silently empty result.
 * @evidence contracts/testing.md#independent-expectations The fixture authors missing.json as the manifest target without creating that file; the expected rejection follows the declared preset resolution contract.
 * @evidence contracts/testing.md#distinguishing-cases Only the negative case is run: a preset whose package.json#tsconfig names a file that was never created. The accepted pattern is the union of the not-found message and the file name, so the exact wording is not pinned; the healthy manifest-selected case is not executed here.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a project extending a bare preset whose package.json#tsconfig points at a missing file in a private temp directory; no install, native build, compiler process or CLI is involved.
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
