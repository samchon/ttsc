import { TestProject } from "../../../../utils/src/TestProject";

import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies a relative extends target resolves as a file or its json sibling and
 * never as a directory.
 *
 * TypeScript resolves a relative `extends` target as that file or its `.json`
 * sibling, never as a directory's `tsconfig.json`.
 *
 * 1. Create a config directory holding a tsconfig and a sibling json file of the
 *    same name, and extend the bare name.
 * 2. Require the json file to win, then remove it and require the
 *    extended-config-not-found error.
 * 3. Add a file with a doubled json suffix and require an explicit json target not
 *    to probe it.
 *
 * @evidence contracts/testing.md#behavioral-verification Distinguishes a sibling config.json from directory config/tsconfig.json, then rejects directory-only and double-suffix fallback paths.
 * @evidence contracts/testing.md#independent-expectations The fixture deliberately gives file and directory presets different output values; relative extends permits the file or implicit .json sibling, not directory expansion or .json.json.
 * @evidence contracts/testing.md#distinguishing-cases A backslash relative specifier finds the file; removing that file rejects the directory-only alternative, and an explicit .json spelling must not probe a doubled suffix.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a project extending ..\config where both a config.json file and a config/tsconfig.json directory exist, then only the directory, then an explicit .json target in a private temp directory; no install, native build, compiler process or CLI is involved.
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
