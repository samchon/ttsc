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
  if (context.plugin.selectionMode !== undefined) {
    const fs = require("node:fs");
    const selected = require(context.plugin.selectionSpecifier ?? (context.plugin.selectionMode === "mapped-aba" ? "#observation-selection" : "batch-observation-selection"));
    const churn = context.plugin.selectionMode === "selected-cutoff" ? context.plugin.selectionSibling : context.plugin.selectionNearer;
    if (context.plugin.selectionMode !== "mapped-record") {
      fs.mkdirSync(churn);
      fs.rmdirSync(churn);
    }
    return { name: selected, source: context.plugin.fixtureSource, capabilities: { projectContextArgs: true } };
  }
  if (observation === undefined)
    return { name: context.plugin.name, source: context.plugin.fixtureSource, stage: context.plugin.stage, hostInputHashes: {}, ...(context.plugin.publicCommand ? { capabilities: { projectContextArgs: true } } : {}) };
  const fs = require("node:fs");
  const settings = require("node:path").join(context.dirname, "cache-settings.json");
  fs.appendFileSync(context.plugin.evaluationCounter, "x");
  if (observation === "native-proof") {
    const bytes = fs.readFileSync(settings);
    return { name: "native-input-mutator", source: context.plugin.fixtureSource, stage: context.plugin.stage,
      hostInputs: [settings], hostInputHashes: { [settings]: require("node:crypto").createHash("sha256").update(bytes).digest("hex") } };
  }
  if (observation === "descriptor-aba") {
    const dependency = context.plugin.observationDependency;
    const before = fs.readFileSync(dependency, "utf8");
    const during = 'module.exports = { name: "during" };\n';
    const { registerHooks } = require("node:module");
    const href = require("node:url").pathToFileURL(dependency).href;
    registerHooks({ load(url, loadContext, nextLoad) {
      if (url !== href) return nextLoad(url, loadContext);
      fs.writeFileSync(dependency, during);
      try { return nextLoad(url, loadContext); }
      finally { fs.writeFileSync(dependency, before); }
    } });
    const selected = require(dependency);
    return { name: selected.name, source: context.plugin.fixtureSource };
  }
  if (observation === "descriptor-retarget") {
    const selected = require(require("node:path").join(context.plugin.observationLink, "selection.cjs"));
    fs.unlinkSync(context.plugin.observationLink);
    fs.symlinkSync(context.plugin.observationTarget, context.plugin.observationLink, process.platform === "win32" ? "junction" : "dir");
    return { name: selected.name, source: context.plugin.fixtureSource };
  }
  if (observation === "capability-module")
    return { name: "capability-probe", source: context.plugin.fixtureSource, capabilities: { probe: true }, hostInputHashes: {} };
  if (observation === "capability-undeclared")
    return { name: "capability-probe", source: context.plugin.fixtureSource, capabilities: JSON.parse(fs.readFileSync(settings, "utf8")) };
  if (observation === "capability-race") {
    const capabilities = require("batch-cache-capability");
    const nearer = require("node:path").join(context.dirname, "node_modules/batch-cache-capability");
    fs.mkdirSync(nearer, { recursive: true });
    fs.writeFileSync(require("node:path").join(nearer, "package.json"), '{"name":"batch-cache-capability","main":"index.cjs"}\n');
    fs.writeFileSync(require("node:path").join(nearer, "index.cjs"), 'module.exports = { probe: false };\n');
    return { name: "capability-probe", source: context.plugin.fixtureSource, capabilities };
  }
  if (observation === "isolation") {
    if (cachedInput.name === "bad") throw new Error("descriptor is bad");
    return {
      name: cachedInput.name,
      get source() { return require("node:path").resolve(context.dirname, require("./cache-source")); },
    };
  }
  if (observation === "collection")
    return { name: "collected", source: context.plugin.fixtureSource, hostInputHashes: {} };
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
