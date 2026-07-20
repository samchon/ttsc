import assert from "node:assert/strict";

import { installPlaygroundDependencies } from "../../../../packages/playground/lib/src/npm/installPlaygroundDependencies.js";
import { selectVersion } from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import { createTarball } from "../internal/tarball";

type Metadata = Parameters<typeof selectVersion>[0];

/**
 * Verifies playground npm registry: preserves declared package constraints.
 *
 * The loader mounts code into the compiler, editor, and Execute sandbox, so it
 * must solve every range that reaches a package and resolve an npm alias
 * through the package named on the right side of `npm:`. Dropping a late range
 * or querying the alias name installs a package the manifest never selected.
 *
 * 1. Select versions across semver ranges and reject unsatisfied constraints.
 * 2. Install an aliased transitive dependency under its alias key, then reject a
 *    second range discovered after the first version was already mounted.
 */
export const test_npm_registry_respects_manifest_constraints = async () => {
  const versions: Metadata = {
    name: "fixture",
    "dist-tags": { stable: "1.9.9" },
    versions: {
      "1.0.0": { name: "fixture", version: "1.0.0" },
      "1.9.9": { name: "fixture", version: "1.9.9" },
      "2.0.0": { name: "fixture", version: "2.0.0" },
    },
  };
  for (const range of ["^1", ">=1 <2", "<2.0.0", "~1.9", "1.x"]) {
    assert.equal(selectVersion(versions, range), "1.9.9", range);
  }
  assert.equal(selectVersion(versions, ["stable", "^1"]), "1.9.9");
  assert.throws(() => selectVersion(versions, "^3"), /No version/);
  assert.throws(() => selectVersion(versions, "missing-tag"), /dist-tag/);

  const rootTarball = createTarball([
    {
      body: JSON.stringify({
        dependencies: { aliased: "npm:actual@^1.0.0" },
      }),
      path: "package/package.json",
    },
    { body: "export {};", path: "package/index.d.ts" },
  ]);
  const actualTarball = createTarball([
    { body: JSON.stringify({}), path: "package/package.json" },
    { body: "export declare const answer: 42;", path: "package/index.d.ts" },
    { body: "module.exports = 42;", path: "package/index.js" },
  ]);
  const metadata = new Map<string, Metadata>([
    [
      "root",
      {
        name: "root",
        versions: {
          "1.0.0": {
            dist: { tarball: "https://tar.invalid/root.tgz" },
            name: "root",
            version: "1.0.0",
          },
        },
      },
    ],
    [
      "actual",
      {
        name: "actual",
        versions: {
          "1.9.9": {
            dist: { tarball: "https://tar.invalid/actual.tgz" },
            name: "actual",
            version: "1.9.9",
          },
        },
      },
    ],
  ]);
  const requests: string[] = [];
  const result = await installPlaygroundDependencies(["root"], {
    fetch: async (input: string): Promise<Response> => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith("https://registry.npmjs.org/")) {
        const name = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
        const value = metadata.get(name);
        return value
          ? new Response(JSON.stringify(value))
          : new Response("not found", { status: 404 });
      }
      if (url.endsWith("root.tgz")) return new Response(rootTarball);
      if (url.endsWith("actual.tgz")) return new Response(actualTarball);
      throw new Error(`Unexpected request ${url}.`);
    },
  });
  assert.ok(
    requests.some((url) => url.endsWith("/actual")),
    "the alias must query its npm target",
  );
  assert.ok(
    !requests.some((url) => url.endsWith("/aliased")),
    "the alias name is only the mount point",
  );
  assert.deepEqual(
    result.packages.map(({ name, version }) => ({ name, version })),
    [
      { name: "root", version: "1.0.0" },
      { name: "aliased", version: "1.9.9" },
    ],
  );
  assert.equal(result.runtimeFiles["aliased/index.js"], "module.exports = 42;");

  const lateConstraintTarballs = new Map<string, ArrayBuffer>([
    [
      "root",
      createTarball([
        {
          body: JSON.stringify({ dependencies: { a: "^1", b: "*" } }),
          path: "package/package.json",
        },
        { body: "export {};", path: "package/index.d.ts" },
      ]),
    ],
    [
      "a",
      createTarball([
        { body: JSON.stringify({}), path: "package/package.json" },
        { body: "export {};", path: "package/index.d.ts" },
      ]),
    ],
    [
      "b",
      createTarball([
        {
          body: JSON.stringify({ dependencies: { a: "^2" } }),
          path: "package/package.json",
        },
        { body: "export {};", path: "package/index.d.ts" },
      ]),
    ],
  ]);
  const lateMetadata = new Map<string, Metadata>([
    ["root", metadataFor("root", "1.0.0", "https://tar.invalid/root-late.tgz")],
    [
      "a",
      {
        name: "a",
        versions: {
          "1.9.9": {
            dist: { tarball: "https://tar.invalid/a-late.tgz" },
            name: "a",
            version: "1.9.9",
          },
          "2.0.0": {
            dist: { tarball: "https://tar.invalid/a-late.tgz" },
            name: "a",
            version: "2.0.0",
          },
        },
      },
    ],
    ["b", metadataFor("b", "1.0.0", "https://tar.invalid/b-late.tgz")],
  ]);
  await assert.rejects(
    installPlaygroundDependencies(["root"], {
      fetch: async (input: string): Promise<Response> => {
        const url = String(input);
        if (url.startsWith("https://registry.npmjs.org/")) {
          const name = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
          return new Response(JSON.stringify(lateMetadata.get(name)));
        }
        const name = url.includes("root-")
          ? "root"
          : url.includes("a-")
            ? "a"
            : "b";
        return new Response(lateConstraintTarballs.get(name)!);
      },
    }),
    /No version of a satisfies .*Requested by root requests "\^1"; b requests "\^2"\./,
  );
};

function metadataFor(name: string, version: string, tarball: string): Metadata {
  return {
    name,
    versions: {
      [version]: {
        dist: { tarball },
        name,
        version,
      },
    },
  };
}
