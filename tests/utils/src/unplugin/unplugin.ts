import path from "node:path";
import { pathToFileURL } from "node:url";

const __dirname = import.meta.dirname;

function libUrl(entrypoint) {
  return pathToFileURL(libPath(entrypoint, "mjs")).href;
}

function libPath(entrypoint, extension) {
  return path.resolve(
    __dirname,
    "../../../../packages/unplugin/lib",
    `${entrypoint}.${extension}`,
  );
}

async function loadUnpluginApi() {
  return import(libUrl("api"));
}

async function loadUnpluginAdapter(entrypoint) {
  const mod = await import(libUrl(entrypoint));
  return mod.default;
}

export {
  __dirname,
  libPath,
  libUrl,
  loadUnpluginAdapter,
  loadUnpluginApi,
  path,
  pathToFileURL,
};
