const assert = require("node:assert/strict");
const { test } = require("node:test");
const { consumerDependencies } = require("./consumer-dependencies.cjs");

test("shared installation retains each consumer's direct dependency identities", () => {
  const installed = {
    compiler: "file:./compiler.tgz",
    "@scope/adapter": "^1.0.0",
    classic: "npm:typescript@6.0.3",
    native: "npm:typescript@7.0.2",
    lint: "file:./lint.tgz",
  };
  assert.deepEqual(consumerDependencies(installed, [
    "compiler", "@scope/adapter@^1.0.0", "classic@npm:typescript@6.0.3",
  ]), {
    compiler: installed.compiler,
    "@scope/adapter": installed["@scope/adapter"],
    classic: installed.classic,
  });
  assert.deepEqual(consumerDependencies(installed, ["native@npm:typescript@7.0.2", "lint"]), {
    native: installed.native, lint: installed.lint,
  });
  assert.deepEqual(consumerDependencies(installed, []), {});
  assert.throws(() => consumerDependencies(installed, ["absent@1.0.0"]), /missing dependency absent/);
});
