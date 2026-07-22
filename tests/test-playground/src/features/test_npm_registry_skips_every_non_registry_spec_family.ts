import assert from "node:assert/strict";

import { installPlaygroundDependencies } from "../../../../packages/playground/lib/src/npm/installPlaygroundDependencies.js";
import {
  type INpmMetadata,
  enqueuePackageDependencies,
} from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import { createTarball } from "../internal/tarball";

/** Unsupported npm source specs never become registry dist-tag requests. */
export const test_npm_registry_skips_every_non_registry_spec_family =
  async () => {
    const skipped: Record<string, string> = {
      "from-file": "file:../local",
      "from-link": "link:../local",
      "from-workspace": "workspace:*",
      "from-portal": "portal:../local",
      "from-http": "https://example.invalid/archive.tgz",
      "from-git-plus": "git+ssh://git@example.invalid/repo.git",
      "from-git-url": "git://example.invalid/repo.git",
      "from-ssh": "ssh://git@example.invalid/repo.git",
      "from-scp": "git@example.invalid:owner/repo.git",
      "from-github": "github:owner/repo",
      "from-gitlab": "gitlab:owner/repo",
      "from-bitbucket": "bitbucket:owner/repo",
      "from-hosted": "owner/repo",
      "from-relative": "./local",
      "from-parent": "../local",
      "from-absolute": "/local",
      "from-home": "~/local",
      "from-drive": "C:\\local",
      "from-unc": "\\\\server\\share",
      "from-malformed": "not a tag",
    };
    const queued: string[] = [];
    enqueuePackageDependencies(
      {
        dependencies: {
          ...skipped,
          alias: "npm:actual@^1",
          exact: "1.0.0",
          range: "^1",
          tagged: "next!",
        },
      },
      ({ name }) => queued.push(name),
      "classification-root",
    );
    assert.deepEqual(queued, ["alias", "exact", "range", "tagged"]);

    const rootTarball = createTarball([
      {
        body: JSON.stringify({
          dependencies: {
            ...skipped,
            supported: "^1",
          },
        }),
        path: "package/package.json",
      },
      { body: "export {};", path: "package/index.d.ts" },
    ]);
    const supportedTarball = createTarball([
      { body: JSON.stringify({}), path: "package/package.json" },
      { body: "export declare const value: 1;", path: "package/index.d.ts" },
    ]);
    const metadata = new Map<string, INpmMetadata>([
      [
        "root",
        {
          name: "root",
          versions: {
            "1.0.0": {
              name: "root",
              version: "1.0.0",
              dist: { tarball: "https://tar.invalid/root.tgz" },
            },
          },
        },
      ],
      [
        "supported",
        {
          name: "supported",
          versions: {
            "1.0.0": {
              name: "supported",
              version: "1.0.0",
              dist: { tarball: "https://tar.invalid/supported.tgz" },
            },
          },
        },
      ],
    ]);
    const registryNames: string[] = [];
    const result = await installPlaygroundDependencies(["root"], {
      fetch: async (input: string): Promise<Response> => {
        const url = String(input);
        if (url.startsWith("https://registry.npmjs.org/")) {
          const name = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
          registryNames.push(name);
          const value = metadata.get(name);
          return value
            ? new Response(JSON.stringify(value))
            : new Response("not found", { status: 404 });
        }
        if (url.endsWith("/root.tgz")) return new Response(rootTarball);
        if (url.endsWith("/supported.tgz"))
          return new Response(supportedTarball);
        throw new Error(`Unexpected request ${url}.`);
      },
    });

    assert.deepEqual(registryNames, ["root", "supported"]);
    assert.deepEqual(
      result.packages.map(({ name }) => name),
      ["root", "supported"],
    );
  };
