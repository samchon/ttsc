import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  os,
  path,
  readProjectConfig,
} from "../../internal/project";

/**
 * Verifies readProjectConfig resolves inherited relative path options from the
 * declaring file.
 *
 * TypeScript resolves path-type options (`baseUrl`, `rootDir`, etc.) relative
 * to the file that declares them. `readProjectConfig` must follow the same rule
 * so that a shared tsconfig can express paths relative to its own location and
 * they remain correct regardless of where the extending project lives.
 *
 * 1. Create a `config/tsconfig.json` that sets `baseUrl: "../shared-base"` and
 *    `rootDir: "../shared-src"`.
 * 2. Write a `project/tsconfig.json` that extends the shared config.
 * 3. Assert both paths are returned as absolute paths anchored at `config/`, not
 *    at `project/`.
 */
export const test_readprojectconfig_resolves_inherited_relative_path_options_from_the_declaring_file =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const shared = path.join(root, "config");
    const project = path.join(root, "project");
    fs.mkdirSync(shared, { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(shared, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: "../shared-base",
            rootDir: "../shared-src",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({ extends: "../config/tsconfig.json" }, null, 2),
      "utf8",
    );

    const parsed = readProjectConfig({
      tsconfig: path.join(project, "tsconfig.json"),
    });

    assert.equal(
      parsed.compilerOptions.baseUrl,
      path.join(root, "shared-base"),
    );
    assert.equal(parsed.compilerOptions.rootDir, path.join(root, "shared-src"));
  };
