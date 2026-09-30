import { TestProject } from "../../../../utils/src/TestProject";

import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * TypeScript resolves a relative `extends` target as that file or its `.json`
 * sibling, never as a directory's `tsconfig.json`.
 *
 * @evidence contracts/testing.md#behavioral-verification Distinguishes a sibling config.json from directory config/tsconfig.json, then rejects directory-only and double-suffix fallback paths.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately gives file and directory presets different output values; relative extends permits the file or implicit .json sibling, not directory expansion or .json.json.
 * @evidence contracts/testing.md#distinguishing-cases A backslash relative specifier finds the file; removing that file rejects the directory-only alternative, and an explicit .json spelling must not probe a doubled suffix.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the exported test_readprojectconfig_resolves_extends_as_a_file once under src/unit/project. It calls the authored readProjectConfig on an isolated fixture directory; there is no installation, native build or CLI process.
 */
export const test_readprojectconfig_resolves_extends_as_a_file = () => {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-project-"));
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
    JSON.stringify({ extends: "..\\config", compilerOptions: {} }),
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
