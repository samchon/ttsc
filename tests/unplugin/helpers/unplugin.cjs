const path = require("node:path");
const { pathToFileURL } = require("node:url");

function libUrl(entrypoint) {
  return pathToFileURL(
    path.resolve(
      __dirname,
      "../../../packages/unplugin/lib",
      `${entrypoint}.js`,
    ),
  ).href;
}

async function loadUnpluginApi() {
  return import(libUrl("api"));
}

async function loadUnpluginAdapter(entrypoint) {
  const mod = await import(libUrl(entrypoint));
  return mod.default;
}

module.exports = {
  libUrl,
  loadUnpluginAdapter,
  loadUnpluginApi,
};
