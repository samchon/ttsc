import { TestProject } from "@ttsc/testing";

import { assert, fs, path, readProjectConfig } from "../../internal/project";

/**
 * TypeScript resolves a relative `extends` target as that file or its `.json`
 * sibling, never as a directory's `tsconfig.json`.
 */
export const test_readprojectconfig_resolves_extends_as_a_file = () => {
  const root = TestProject.tmpdir("ttsc-project-");
  const configDirectory = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(configDirectory, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(configDirectory, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { outDir: "directory-output" } }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "config.json"),
    JSON.stringify({ compilerOptions: { outDir: "file-output" } }),
    "utf8",
  );
  const tsconfig = path.join(project, "tsconfig.json");
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({ extends: "../config", compilerOptions: {} }),
    "utf8",
  );

  assert.equal(
    readProjectConfig({ tsconfig }).compilerOptions.outDir,
    path.join(root, "file-output"),
  );

  fs.unlinkSync(path.join(root, "config.json"));
  assert.throws(
    () => readProjectConfig({ tsconfig }),
    /extended tsconfig not found/,
    "a directory must neither be read as JSON nor expanded to tsconfig.json",
  );

  fs.writeFileSync(
    path.join(root, "explicit.json.json"),
    JSON.stringify({ compilerOptions: { outDir: "double-suffix-output" } }),
    "utf8",
  );
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({ extends: "../explicit.json", compilerOptions: {} }),
    "utf8",
  );
  assert.throws(
    () => readProjectConfig({ tsconfig }),
    /extended tsconfig not found/,
    "an explicit .json target must not probe a double suffix",
  );
};
