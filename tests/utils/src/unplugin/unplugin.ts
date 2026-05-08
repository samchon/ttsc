import path from "node:path";
import { pathToFileURL } from "node:url";

import { workspaceRoot } from "../project";

export namespace TestUnpluginRuntime {
  export function libUrl(entrypoint: string): string {
    return pathToFileURL(libPath(entrypoint, "mjs")).href;
  }

  export function libPath(entrypoint: string, extension: "js" | "mjs"): string {
    return path.resolve(
      workspaceRoot,
      "packages/unplugin/lib",
      `${entrypoint}.${extension}`,
    );
  }

  export async function loadUnpluginApi(): Promise<any> {
    return import(libUrl("api"));
  }

  export async function loadUnpluginAdapter(entrypoint: string): Promise<any> {
    const mod = await import(libUrl(entrypoint));
    return mod.default;
  }
}
