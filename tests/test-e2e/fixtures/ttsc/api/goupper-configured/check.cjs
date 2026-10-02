Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
module.exports = {
  name: "check-fixture",
  source: "__SHARED_COMPILER_SOURCE__",
  stage: "check",
};
