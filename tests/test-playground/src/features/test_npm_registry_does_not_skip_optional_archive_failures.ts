import assert from "node:assert/strict";

import { installPlaygroundDependencies } from "../../../../packages/playground/lib/src/index.js";
import { createNpmFixtureTarball } from "../internal/npmFixture";

/**
 * Verifies optional semantics stop at registry absence.
 *
 * Once optional package metadata exists, an integrity failure is a corrupt
 * archive and must abort the install rather than silently omit the dependency.
 */
export const test_npm_registry_does_not_skip_optional_archive_failures =
  async () => {
    const root = createNpmFixtureTarball({
      name: "root",
      optionalDependencies: { optional: "*" },
      version: "1.0.0",
    });
    const optional = createNpmFixtureTarball({
      name: "optional",
      version: "1.0.0",
    });
    const install = (optionalDist: { integrity?: string; tarball?: string }) =>
      installPlaygroundDependencies(["root"], {
        fetch: async (url) => {
          const name = url.includes("/optional") ? "optional" : "root";
          if (url.startsWith("https://registry.npmjs.org/")) {
            return Response.json({
              name,
              "dist-tags": { latest: "1.0.0" },
              versions: {
                "1.0.0": {
                  name,
                  version: "1.0.0",
                  dist:
                    name === "optional"
                      ? optionalDist
                      : { tarball: "https://tar.invalid/root.tgz" },
                },
              },
            });
          }
          return new Response(name === "optional" ? optional : root);
        },
      });

    await assert.rejects(
      install({
        integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
        tarball: "https://tar.invalid/optional.tgz",
      }),
      /Failed to install optional@1\.0\.0: tarball integrity mismatch/,
    );
    await assert.rejects(
      install({}),
      /No tarball found for optional@1\.0\.0/,
      "optional metadata without an archive is not a registry-absence skip",
    );
  };
