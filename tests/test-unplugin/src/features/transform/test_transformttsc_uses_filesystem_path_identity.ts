import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies compiler-envelope and bundler paths compare by filesystem identity.
 *
 * Case-insensitive hosts must recover an absolute compiler key when a bundler
 * id changes only case, while a case-sensitive host must keep two real files
 * apart. It exercises the native transform envelope's source selection and
 * cache reuse, then pins external snapshot keys, a trailing separator, and
 * Windows UNC casing through the shared identity helper.
 *
 * 1. Run the case-insensitive assertions only when the host reports one path
 *    identity.
 * 2. Run the case-sensitive twin only when two on-disk case variants differ.
 * 3. Assert transformed output, cache reuse, and external-hash keys match that
 *    host contract.
 */
export const test_transformttsc_uses_filesystem_path_identity = async () => {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const core = await import(TestUnpluginRuntime.libUrl("core/transform"));
  const root = TestUnpluginProject.createProject();
  const file = TestUnpluginProject.mainFile(root);
  const alternate = alternateBasenameCase(file);

  if (core.pathIdentityKey(file) === core.pathIdentityKey(alternate)) {
    const cache = api.createTtscTransformCache();
    const options = api.resolveOptions({
      project: path.join(root, "tsconfig.json"),
    });
    const first = await api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(first);
    const generation = [...cache.values()][0];
    const second = await api.transformTtsc(
      alternate,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(second);
    TestUnpluginProject.assertTransformedToPlugin(second.code);
    assert.strictEqual(
      [...cache.values()][0],
      generation,
      "a case-only bundler id must reuse the same transform generation",
    );

    const dependency = path.join(
      TestProject.tmpdir("ttsc-unplugin-path-identity-"),
      "dependency.d.ts",
    );
    fs.writeFileSync(dependency, "export {};\n", "utf8");
    assert.equal(
      Object.keys(
        api.collectExternalInputHashes([
          dependency,
          alternateBasenameCase(dependency),
        ]),
      ).length,
      1,
    );
    assert.equal(
      core.pathIdentityKey(`${file}${path.sep}`),
      core.pathIdentityKey(file),
    );
    if (process.platform === "win32") {
      assert.equal(
        core.pathIdentityKey("\\\\server\\share\\src\\main.ts"),
        core.pathIdentityKey("\\\\SERVER\\share\\src\\main.ts"),
      );
    }
    return;
  }

  const upper = path.join(root, "src", "Main.ts");
  fs.writeFileSync(upper, "export const upper = true;\n", "utf8");
  const options = api.resolveOptions({
    project: path.join(root, "tsconfig.json"),
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/Main.ts",
      },
    ],
  });
  const cache = api.createTtscTransformCache();
  const lower = await api.transformTtsc(
    file,
    fs.readFileSync(file, "utf8"),
    options,
    undefined,
    cache,
  );
  const upperResult = await api.transformTtsc(
    upper,
    fs.readFileSync(upper, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(lower);
  assert.ok(upperResult);
  TestUnpluginProject.assertTransformedToPlugin(lower.code);
  assert.match(upperResult.code, /upper = true/);
  assert.notEqual(core.pathIdentityKey(file), core.pathIdentityKey(upper));
  assert.equal(
    Object.keys(api.collectExternalInputHashes([file, upper])).length,
    2,
  );
};

function alternateBasenameCase(file: string): string {
  const basename = path.basename(file);
  for (let index = basename.length - 1; index >= 0; --index) {
    const character = basename[index]!;
    if (character >= "a" && character <= "z") {
      return path.join(
        path.dirname(file),
        `${basename.slice(0, index)}${character.toUpperCase()}${basename.slice(
          index + 1,
        )}`,
      );
    }
    if (character >= "A" && character <= "Z") {
      return path.join(
        path.dirname(file),
        `${basename.slice(0, index)}${character.toLowerCase()}${basename.slice(
          index + 1,
        )}`,
      );
    }
  }
  throw new Error(`Could not change basename case: ${file}`);
}
