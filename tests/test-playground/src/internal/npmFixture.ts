import { installPlaygroundDependencies } from "../../../../packages/playground/lib/src/index.js";
import type { IPlaygroundDependencyInstallOptions } from "../../../../packages/playground/lib/src/index.js";
import { createTarball } from "./tarball";

/** Minimal fixture package archive accepted by the browser npm installer. */
export function createNpmFixtureTarball(
  packageJson: Record<string, unknown> = {
    name: "fixture",
    version: "1.0.0",
  },
): ArrayBuffer {
  return createTarball([
    {
      body: JSON.stringify(packageJson),
      path: "package/package.json",
    },
    {
      body: "module.exports = true;\n",
      path: "package/index.js",
    },
    {
      body: "export declare const value: true;\n",
      path: "package/index.d.ts",
    },
  ]);
}

/** Install one package through controlled registry metadata and tarball bytes. */
export function installNpmFixture(input: {
  dist?: {
    integrity?: string;
    shasum?: string;
    tarball?: string;
  };
  options?: Omit<IPlaygroundDependencyInstallOptions, "fetch">;
  packageName?: string;
  responseHeaders?: HeadersInit;
  tarball: ArrayBuffer;
}): ReturnType<typeof installPlaygroundDependencies> {
  const packageName = input.packageName ?? "fixture";
  const tarballUrl =
    input.dist?.tarball ?? `https://tar.invalid/${packageName}.tgz`;
  return installPlaygroundDependencies([packageName], {
    ...input.options,
    fetch: async (url) => {
      if (url.startsWith("https://registry.npmjs.org/")) {
        return Response.json({
          name: packageName,
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              name: packageName,
              version: "1.0.0",
              dist: {
                ...input.dist,
                tarball: tarballUrl,
              },
            },
          },
        });
      }
      if (url === tarballUrl) {
        return new Response(input.tarball, {
          headers: input.responseHeaders,
        });
      }
      return new Response(null, { status: 404 });
    },
  });
}
