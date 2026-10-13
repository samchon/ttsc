const assert = require("node:assert/strict");

(async () => {
  const [moduleURL, mode] = process.argv.slice(2);
  const { ResidentCheckProcess } = await import(moduleURL);
  const owner = new ResidentCheckProcess({
    binary: process.execPath,
    args: ["-e", "process.stdin.resume();process.stdin.on('end',()=>process.exit(0));", mode],
    cwd: process.cwd(),
    env: process.env,
  });
  const expected = mode === "error"
    ? /authored resident owner startup error/
    : /owner exited before child retirement \(code 7\)/;
  await assert.rejects(owner.close(), expected);
  await assert.rejects(owner.waitForExit(), expected);
  await assert.rejects(owner.close(), expected);
  console.log(`unknown owner ${mode} remains failed`);
})();
