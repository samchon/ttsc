const assert = require("node:assert/strict");
const factory = require("../descriptors/default.cjs").default;

// Preserve the existing descriptor and native composition after checking what
// the actual isolated evaluator received from the public compiler instance.
module.exports = (context) => {
  for (const [name, value] of Object.entries(context.plugin.environmentProbe))
    assert.equal(process.env[name], value, "descriptor environment: " + name);
  const names = Object.keys(process.env);
  for (const name of context.plugin.absentEnvironmentProbe)
    assert.equal(names.includes(name), false, "native alias spelling: " + name);
  return factory(context);
};
