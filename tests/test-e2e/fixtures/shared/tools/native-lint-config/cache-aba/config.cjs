const fs = require("node:fs");
const path = require("node:path");
const { registerHooks } = require("node:module");
const { pathToFileURL } = require("node:url");
const dependency = path.join(__dirname, "selection.cjs");
const dependencyURL = pathToFileURL(fs.realpathSync(dependency)).href;
const before = fs.readFileSync(dependency, "utf8");
const during = 'module.exports = { rules: { "no-debugger": "off" } };\n';
registerHooks({
  load(url, context, nextLoad) {
    if (url !== dependencyURL) return nextLoad(url, context);
    fs.writeFileSync(dependency, during, "utf8");
    try {
      return nextLoad(url, context);
    } finally {
      fs.writeFileSync(dependency, before, "utf8");
    }
  },
});
module.exports = () => {
  const counter = process.env.TTSC_LINT_TEST_CACHE_COUNTER;
  if (counter) fs.appendFileSync(counter, JSON.stringify({
    pid: process.pid, location: __filename, at: new Date().toISOString(),
  }) + "\n");
  return { ...require(dependency), extends: "../lint.config.ts" };
};
