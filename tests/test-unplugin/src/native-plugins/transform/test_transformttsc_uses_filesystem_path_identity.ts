import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../../../../packages/ttsc/lib/internal/pathIdentity/createFilesystemPathIdentityContext.js";
import { normalizeHostInputName } from "../../../../../packages/unplugin/lib/core/transform/filesystem/normalizeHostInputName.mjs";
import { pathIdentityKey } from "../../../../../packages/unplugin/lib/core/transform/filesystem/pathIdentityKey.mjs";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Simulated Windows insensitive aliases merge while sensitive existing/missing spellings differ; real host twins verify PLUGIN or distinct upper output and external-hash deduplication.
 * @evidence contracts/testing.md#independent-expectations Authored path policy and on-disk case variants define expected identities; real branch selection uses production helper so wrong host classification may hide a branch.
 * @evidence contracts/testing.md#distinguishing-cases Insensitive/sensitive Windows scopes, candidate casing, event normalization, actual host case policy, trailing slash and conditional UNC.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_transformttsc_uses_filesystem_path_identity is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts. Its body owns the assertions above; the path-identity case also retains direct portable helper assertions here.
 * @evidence contracts/e2e.md#necessary-boundary Native envelope source lookup and cache delivery run against actual host case policy; direct Windows identity simulations remain portable assertions mixed into this case and do not require native execution themselves.
 * @evidence contracts/e2e.md#shared-execution One fixture/API supports the host's actual sensitive or insensitive branch. Synthetic Windows cases reuse one injected context without a host. Native fixture artifacts remain shared while source identities stay private.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project and cache identities separate mutable inputs; tracked roots are removed on process exit. Cache-local providers and identity contexts avoid global filesystem patches. There is no finally cache-reset guarantee here; process exit bounds remaining observers.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Simulated Windows insensitive aliases merge while sensitive existing/missing spellings differ; real host twins verify PLUGIN or distinct upper output and external-hash deduplication. No assertion is transferred or removed by these tags; mixed portable helpers and cleanup limits remain explicitly disclosed.
 */
export async function test_transformttsc_uses_filesystem_path_identity(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const core = { normalizeHostInputName, pathIdentityKey };
  const root = TestUnpluginProject.createProject();
  const file = TestUnpluginProject.mainFile(root);
  const alternate = alternateBasenameCase(file);
  const missing = (): never => {
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  };
  const windows = createFilesystemPathIdentityContext({
    platform: "win32",
    caseSensitive: (directory) =>
      directory.toLowerCase().startsWith("c:\\sensitive"),
    realpath: (location) => {
      const resolved = path.win32.resolve(location);
      const folded = resolved.toLowerCase();
      if (folded === "c:\\ordinary") return "C:\\Ordinary";
      if (folded === "c:\\ordinary\\src") return "C:\\Ordinary\\src";
      if (resolved === "C:\\Sensitive") return resolved;
      if (resolved === "C:\\Sensitive\\src") return resolved;
      if (resolved === "C:\\Sensitive\\src\\Main.ts") return resolved;
      if (resolved === "C:\\Sensitive\\src\\main.ts") return resolved;
      return missing();
    },
  });
  assert.equal(
    core.pathIdentityKey("C:\\ORDINARY\\src\\Main.ts", windows),
    core.pathIdentityKey("c:\\ordinary\\SRC\\main.ts", windows),
    "ordinary Windows aliases must share one unplugin identity",
  );
  assert.notEqual(
    core.pathIdentityKey("C:\\Sensitive\\src\\Main.ts", windows),
    core.pathIdentityKey("C:\\Sensitive\\src\\main.ts", windows),
    "case-sensitive Windows modules must retain independent identities",
  );
  assert.notEqual(
    core.pathIdentityKey("C:\\Sensitive\\src\\Future.ts", windows),
    core.pathIdentityKey("C:\\Sensitive\\src\\future.ts", windows),
    "missing module candidates must inherit sensitive ownership",
  );
  assert.equal(
    core.normalizeHostInputName("Selection.JS", false),
    "selection.js",
    "case-insensitive watcher events must match candidate spellings",
  );
  assert.equal(
    core.normalizeHostInputName("Selection.JS", true),
    "Selection.JS",
    "case-sensitive filesystems must preserve distinct entry names",
  );

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
}

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
