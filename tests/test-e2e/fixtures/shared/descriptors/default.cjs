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
const cachedInput = require("./cache-input.cjs");
exports.default = (context) => {
  const observation = context.plugin.cacheObservation;
  if (observation === undefined)
    return { name: context.plugin.name, source: context.plugin.fixtureSource, hostInputHashes: {} };
  const fs = require("node:fs");
  const settings = require("node:path").join(context.dirname, "cache-settings.json");
  fs.appendFileSync(context.plugin.evaluationCounter, "x");
  if (observation === "module")
    return { name: cachedInput.name, source: context.plugin.fixtureSource, hostInputHashes: {} };
  const text = fs.readFileSync(settings);
  const result = { name: JSON.parse(text.toString("utf8")).name, source: context.plugin.fixtureSource };
  if (observation !== "undeclared") {
    result.hostInputs = [settings];
    result.hostInputHashes = observation === "qualified"
      ? { [settings]: require("node:crypto").createHash("sha256").update(text).digest("hex") }
      : {};
  }
  return result;
};
