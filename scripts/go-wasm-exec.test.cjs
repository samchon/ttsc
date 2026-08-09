// Verifies the js/wasm wrapper's backstop: it ends a program that will not
// exit, names what node was holding, and never touches a healthy run.
//
// The wrapper is the only place that can answer for a wedged wasm program from
// outside it, so its two directions are worth pinning rather than measuring by
// hand once. Both stubs stand in for `wasm_exec_node.js`, which the wrapper
// requires by path.

const assert = require("node:assert");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const wrapper = path.join(__dirname, "go-wasm-exec.cjs");

const runWrapper = (stub, timeout) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "go-wasm-exec-"));
  try {
    const entry = path.join(dir, "stub.js");
    fs.writeFileSync(entry, stub);
    return cp.spawnSync(process.execPath, [wrapper, entry], {
      encoding: "utf8",
      env: {
        ...process.env,
        ...(timeout === undefined ? {} : { TTSC_WASM_EXEC_TIMEOUT: timeout }),
      },
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("the backstop ends a program that will not exit and names what node held", () => {
  const result = runWrapper(
    'process.stdout.write("PASS\\n");\nsetInterval(() => {}, 3600000);\n',
    "1",
  );
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /has not exited after 1s/);
  assert.match(result.stderr, /node is still holding .*fd=1/);
  assert.match(result.stderr, /resources: .*Timeout/);
  assert.match(result.stdout, /PASS/);
});

test("a healthy program is untouched", () => {
  const result = runWrapper('process.stdout.write("ok\\n");\n', "1");
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
  assert.match(result.stdout, /ok/);
});

test("a budget of zero switches the backstop off", () => {
  const result = runWrapper('process.stdout.write("ok\\n");\n', "0");
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
});

test("a budget the wrapper cannot honor is refused rather than ignored", () => {
  // A misspelled knob used to disable the guard in silence, which reads exactly
  // like having it. The ceiling is node's: a delay past a 32-bit millisecond
  // count is clamped to 1ms, so "effectively never" would fail a healthy run at
  // once.
  for (const value of ["", "abc", "120s", "-5", "2147484", "Infinity"]) {
    const result = runWrapper('process.stdout.write("ok\\n");\n', value);
    assert.notStrictEqual(result.status, 0, `expected refusal for ${value}`);
    assert.match(result.stderr, /TTSC_WASM_EXEC_TIMEOUT must be a number/);
  }
});
