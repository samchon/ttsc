const path = require("node:path");

module.exports = function createCompilerTargetProbe(context) {
  return {
    name: "compiler-target-probe",
    source: path.resolve(context.dirname, "go"),
    stage: "check",
    hostInputHashes: {},
  };
};
