import path from "node:path";
import { pathToFileURL } from "node:url";

export namespace TestUnpluginRuntime {
  const __dirname = import.meta.dirname;

  export function libUrl(entrypoint) {
    return pathToFileURL(libPath(entrypoint, "mjs")).href;
  }

  export function libPath(entrypoint, extension) {
    return path.resolve(
      __dirname,
      "../../../../packages/unplugin/lib",
      `${entrypoint}.${extension}`,
    );
  }

  export async function loadUnpluginApi() {
    return import(libUrl("api"));
  }

  export async function loadUnpluginAdapter(entrypoint) {
    const mod = await import(libUrl(entrypoint));
    return mod.default;
  }
}
