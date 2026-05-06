const path = require("node:path");
const { pathToFileURL } = require("node:url");

function libUrl(entrypoint) {
  return pathToFileURL(libPath(entrypoint, "mjs")).href;
}

function libPath(entrypoint, extension) {
  return path.resolve(
    __dirname,
    "../../../packages/unplugin/lib",
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

module.exports = {
  libPath,
  libUrl,
  loadUnpluginAdapter,
  loadUnpluginApi,
};
