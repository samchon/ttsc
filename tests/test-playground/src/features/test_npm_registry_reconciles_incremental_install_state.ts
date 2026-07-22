import assert from "node:assert/strict";

import { installPlaygroundDependencies } from "../../../../packages/playground/lib/src/npm/installPlaygroundDependencies.js";
import type { INpmMetadata } from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import type { IPlaygroundInstalledDependency } from "../../../../packages/playground/lib/src/structures/IPlaygroundInstalledDependency.js";
import { createTarball } from "../internal/tarball";

/**
 * Incremental installs must reconcile every new edge with the exact mounted
 * registry identity, version, and active requests. Compatible packages reuse
 * their tarballs, required conflicts fail before publication, optional
 * conflicts are omitted, and a full replacement solve can select a version that
 * stale session state would otherwise pin.
 */
export const test_npm_registry_reconciles_incremental_install_state =
  async () => {
    const manifests: Record<string, Record<string, unknown>> = {
      "root-a": { dependencies: { shared: "^2" } },
      "root-compatible": { dependencies: { shared: ">=2" } },
      "root-conflict": { dependencies: { shared: "^1" } },
      "root-optional": { optionalDependencies: { shared: "^1" } },
      "root-new": { dependencies: { shared: "^1" } },
      "root-alias": { dependencies: { alias: "npm:actual@^1" } },
      "root-identity-conflict": { dependencies: { alias: "^1" } },
      "root-abort": {},
      actual: {},
      shared: {},
    };
    const metadata = new Map<string, INpmMetadata>();
    const tarballs = new Map<string, ArrayBuffer>();
    const addVersion = (name: string, version: string): void => {
      const tarball = `https://tar.invalid/${name}-${version}.tgz`;
      const current = metadata.get(name) ?? { name, versions: {} };
      current.versions[version] = {
        dist: { tarball },
        name,
        version,
      };
      metadata.set(name, current);
      tarballs.set(
        tarball,
        createTarball([
          {
            body: JSON.stringify({
              name,
              version,
              ...(manifests[name] ?? {}),
            }),
            path: "package/package.json",
          },
          {
            body: `export declare const version: ${JSON.stringify(version)};`,
            path: "package/index.d.ts",
          },
        ]),
      );
    };
    for (const name of Object.keys(manifests)) addVersion(name, "1.0.0");
    addVersion("shared", "2.0.0");

    const requests: string[] = [];
    const fetch = async (input: string): Promise<Response> => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith("https://registry.npmjs.org/")) {
        const name = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
        const value = metadata.get(name);
        return value
          ? new Response(JSON.stringify(value))
          : new Response("not found", { status: 404 });
      }
      const tarball = tarballs.get(url);
      if (tarball) return new Response(tarball);
      throw new Error(`Unexpected request ${url}.`);
    };

    const first = await installPlaygroundDependencies(["root-a"], { fetch });
    assert.deepEqual(packageVersions(first.resolvedDependencies), {
      "root-a": "1.0.0",
      shared: "2.0.0",
    });

    const compatibleStart = requests.length;
    const compatible = await installPlaygroundDependencies(
      ["root-compatible"],
      { fetch, installedDependencies: first.resolvedDependencies },
    );
    const compatibleRequests = requests.slice(compatibleStart);
    assert.deepEqual(
      compatible.packages.map(({ name }) => name),
      ["root-compatible"],
      "the mounted shared package must not be downloaded again",
    );
    assert.ok(
      !compatibleRequests.some((url) => url.endsWith("/shared-2.0.0.tgz")),
      "a compatible mounted version reuses its existing tarball",
    );
    const mounted = new Map(
      compatible.resolvedDependencies.map(
        (dependency) => [dependency.name, dependency] as const,
      ),
    );
    assert.equal(mounted.get("root-a")?.version, "1.0.0");
    assert.deepEqual(
      mounted.get("shared")?.requests.map(({ range, requester }) => ({
        range,
        requester,
      })),
      [
        { range: "^2", requester: "root-a" },
        { range: ">=2", requester: "root-compatible" },
      ],
    );

    await assert.rejects(
      installPlaygroundDependencies(["root-conflict"], {
        fetch,
        installedDependencies: mounted.values(),
      }),
      /Mounted shared@2\.0\.0 from shared is incompatible.*root-a requests "\^2"; root-compatible requests ">=2"; root-conflict requests "\^1"/,
    );

    const optional = await installPlaygroundDependencies(["root-optional"], {
      fetch,
      installedDependencies: mounted.values(),
    });
    assert.deepEqual(
      optional.packages.map(({ name }) => name),
      ["root-optional"],
    );
    assert.ok(
      optional.resolvedDependencies
        .find(({ name }) => name === "shared")
        ?.requests.every(({ range }) => range !== "^1"),
      "an incompatible optional edge must not enter the active constraints",
    );

    const replacement = await installPlaygroundDependencies(["root-new"], {
      fetch,
    });
    assert.deepEqual(packageVersions(replacement.resolvedDependencies), {
      "root-new": "1.0.0",
      shared: "1.0.0",
    });
    assert.ok(
      Object.keys(replacement.compilerFiles).every(
        (file) => !file.startsWith("node_modules/root-a/"),
      ),
      "a replacement solve contains no files from a removed root",
    );
    assert.ok(
      Object.keys(replacement.editorLibs).every(
        (file) => !file.startsWith("file:///node_modules/root-a/"),
      ),
      "the replacement editor map contains no files from a removed root",
    );
    assert.ok(
      Object.keys(replacement.runtimeFiles).every(
        (file) => !file.startsWith("root-a/"),
      ),
      "the replacement runtime map contains no files from a removed root",
    );
    assert.match(
      replacement.compilerFiles["node_modules/shared/index.d.ts"]!,
      /1\.0\.0/,
    );
    assert.match(
      replacement.editorLibs["file:///node_modules/shared/index.d.ts"]!,
      /1\.0\.0/,
    );
    assert.equal(
      JSON.parse(replacement.runtimeFiles["shared/package.json"]!).version,
      "1.0.0",
    );

    const alias = await installPlaygroundDependencies(["root-alias"], {
      fetch,
    });
    assert.equal(
      alias.resolvedDependencies.find(({ name }) => name === "alias")
        ?.registryName,
      "actual",
    );
    await assert.rejects(
      installPlaygroundDependencies(["root-identity-conflict"], {
        fetch,
        installedDependencies: alias.resolvedDependencies,
      }),
      /Conflicting registry identities for alias: mounted or queued from actual.*from alias/,
    );

    const controller = new AbortController();
    const beforeAbort = JSON.stringify([...mounted.values()]);
    await assert.rejects(
      installPlaygroundDependencies(["root-abort"], {
        installedDependencies: mounted.values(),
        signal: controller.signal,
        fetch: async (input: string): Promise<Response> => {
          const response = await fetch(input);
          controller.abort(abortError());
          return response;
        },
      }),
      { name: "AbortError" },
    );
    assert.equal(
      JSON.stringify([...mounted.values()]),
      beforeAbort,
      "an aborted solve must not mutate the caller's mounted state",
    );
  };

function packageVersions(
  packages: readonly IPlaygroundInstalledDependency[],
): Record<string, string> {
  return Object.fromEntries(
    packages.map(({ name, version }) => [name, version]).sort(),
  );
}

function abortError(): Error {
  const error = new Error("cancelled edit");
  error.name = "AbortError";
  return error;
}
