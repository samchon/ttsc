import path from "node:path";
import { pathToFileURL } from "node:url";

import { TestProject } from "../TestProject";

/**
 * Runtime import helpers for the built @ttsc/unplugin package.
 *
 * Adapter tests import the compiled ESM entrypoints through file URLs so they
 * validate the package output exactly as Node will load it after a build.
 */
export namespace TestUnpluginRuntime {
  /** Convert a built unplugin entrypoint into a dynamic-importable file URL. */
  export function libUrl(entrypoint: string): string {
    return pathToFileURL(libPath(entrypoint, "mjs")).href;
  }

  /** Resolve a built CommonJS or ESM entrypoint under packages/unplugin/lib. */
  export function libPath(entrypoint: string, extension: "js" | "mjs"): string {
    return path.resolve(
      TestProject.WORKSPACE_ROOT,
      "packages/unplugin/lib",
      `${entrypoint}.${extension}`,
    );
  }

  /** Load the built public transform API entrypoint. */
  export async function loadUnpluginApi(): Promise<any> {
    return import(libUrl("api"));
  }

  /** Load a built adapter entrypoint and return its default plugin factory. */
  export async function loadUnpluginAdapter(entrypoint: string): Promise<any> {
    const mod = await import(libUrl(entrypoint));
    return mod.default;
  }
}
