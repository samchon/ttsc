const local = require("#local-descriptor");
const installed = require("#installed-descriptor");
if (local !== "local-descriptor-input" || installed !== "installed-descriptor-input")
  throw new Error("descriptor package imports selected another authored input");
for (const specifier of ["#missing-local-descriptor", "#missing-package-descriptor"]) {
  let missing = false;
  try {
    const optional = require(specifier);
    if (specifier === "#missing-local-descriptor" && optional === "appeared-descriptor-input") continue;
  }
  catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    missing = true;
  }
  if (!missing) throw new Error("the independently absent descriptor input unexpectedly resolved: " + specifier);
}
exports.default = (context) => ({ name: context.plugin.name, source: context.plugin.fixtureSource, hostInputHashes: {} });
