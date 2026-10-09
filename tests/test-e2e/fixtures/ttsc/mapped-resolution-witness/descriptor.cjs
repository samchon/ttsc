const fs = require("node:fs");
const path = require("node:path");

module.exports = function (context) {
  const selected = require("#dep");
  fs.appendFileSync(context.plugin.evaluationCounter, "x");
  if (context.plugin.createNear && !fs.existsSync(context.plugin.nearPackage)) {
    fs.mkdirSync(context.plugin.nearPackage, { recursive: true });
    fs.writeFileSync(
      path.join(context.plugin.nearPackage, "package.json"),
      '{"name":"@scope/pkg","main":"index.cjs"}',
    );
    fs.writeFileSync(
      path.join(context.plugin.nearPackage, "index.cjs"),
      'module.exports = "NEAR";\n',
    );
  }
  return {
    name: selected,
    source: context.plugin.fixtureSource,
    capabilities: { probe: true },
    hostInputHashes: {},
  };
};
