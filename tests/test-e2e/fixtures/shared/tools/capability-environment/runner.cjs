const assert = require("node:assert/strict");
const { CapabilityPluginResolver } = require(process.argv[2]);

async function main() {
  const names = ["NODE_OPTIONS", "TTSC_NODE_BINARY"];
  const clear = () => {
    for (const key of Object.keys(process.env))
      if (names.includes(key.toUpperCase())) delete process.env[key];
  };
  clear();
  const resolver = new CapabilityPluginResolver();
  const failures = [];
  const rows = [];
  const options = { cwd: __dirname, tsconfig: "tsconfig.json", capability: "lsp" };
  let normal;
  const verify = async (name, mutation, expected) => {
    let resolution;
    try {
      clear();
      mutation();
      resolution = await resolver.resolve(options);
      assert.equal(resolution.status, "resolved", name);
      assert.deepEqual(resolution.plugins, [], name);
      const current = await resolution.isCurrent();
      rows.push({ name, current });
      assert.equal(current, expected, name);
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    } finally {
      await resolution?.release();
    }
  };
  try {
    normal = await resolver.resolve(options);
    assert.equal(normal.status, "resolved");
    assert.deepEqual(normal.plugins, []);
    assert.equal(await normal.isCurrent(), true, "normal initial proof");
    process.env.node_options = "--trace-warnings";
    assert.equal(await normal.isCurrent(), false, "changed caller environment invalidates the old proof");
    clear();
    assert.equal(await normal.isCurrent(), true, "removing selectors recovers the unchanged normal proof");
    await verify("lowercase preload", () => { process.env.node_options = "--trace-warnings"; }, process.platform !== "win32");
    await verify("uppercase preload", () => { process.env.NODE_OPTIONS = "--trace-warnings"; }, false);
    await verify("blank preload", () => { process.env.node_options = ""; }, true);
    await verify("lowercase relative runtime", () => { process.env.ttsc_node_binary = "relative-node"; }, process.platform !== "win32");
    await verify("uppercase relative runtime", () => { process.env.TTSC_NODE_BINARY = "relative-node"; }, false);
    await verify("normal recovery", () => {}, true);
  } catch (error) {
    failures.push(error);
  } finally {
    clear();
    try {
      await normal?.release();
      await resolver.close();
      console.log("CAPABILITY_ENVIRONMENT_RESOLVER_CLOSED");
    } catch (error) {
      failures.push(error);
    }
  }
  console.log(JSON.stringify({ platform: process.platform, rows }));
  if (failures.length) throw new AggregateError(failures, "capability worker environment identity");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
