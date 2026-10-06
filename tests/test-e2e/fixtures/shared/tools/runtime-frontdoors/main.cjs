const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Mocha = require("mocha").default;
const cache = path.join(process.env.TTSC_CACHE_DIR, "ttsx/project");
assert.deepEqual(fs.existsSync(cache) ? fs.readdirSync(cache) : [], [], "checked-root host starts without another live generation");
const mocha = new Mocha({ reporter: function SilentReporter() {} });
for (const file of ["one/test/first/index.ts", "one/test/second/index.ts", "two/test/third/index.ts"]) mocha.addFile(path.join(__dirname, file));
const names = [];
const runner = mocha.run((failures) => {
  assert.equal(failures, 0, "all three actual Mocha checked roots must pass");
  assert.equal(runner.stats.passes, 3);
  assert.deepEqual(names.sort(), ["first", "second", "third"]);
  assert.equal(fs.readdirSync(cache).length, 3, "the three successful roots coexist until host exit");
  const dependency = require("./src/dep.js");
  console.log(JSON.stringify({ main: require.main === module, value: dependency.value, argv: process.argv.slice(2), roots: { passes: runner.stats.passes, names, coexist: 3 } }));
});
runner.on("pass", (test) => names.push(test.parent.title));
