const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const { formatBatches, resolveBash } = require("./format-go.cjs");

test("Go formatting preserves every tracked path when the argument list is too long", () => {
  const files = ["a.go", "directory with spaces/b.go", "c.go", "d.go", "e.go"];
  const seen = [];
  const failed = formatBatches(files, (batch) => {
    if (batch.length > 2) {
      return { error: Object.assign(new Error("too long"), { code: "E2BIG" }) };
    }
    seen.push(...batch);
    return { status: batch.includes("d.go") ? 1 : 0 };
  });
  assert.deepEqual(seen, files);
  assert.deepEqual(failed.flat(), ["d.go", "e.go"]);

  const bash = resolveBash();
  if (process.platform === "win32") assert.equal(fs.existsSync(bash.binary), true);
  else assert.equal(bash.binary, "bash");
});
