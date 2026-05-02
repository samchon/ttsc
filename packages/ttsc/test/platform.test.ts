const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveBinary } = require("../lib/compiler/internal/resolveBinary.js");

test("resolveBinary prefers TTSC_BINARY absolute override", () => {
  const resolved = resolveBinary({
    env: {
      TTSC_BINARY: "/tmp/custom-ttsc",
    },
  });
  assert.equal(resolved, "/tmp/custom-ttsc");
});
