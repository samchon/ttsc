import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies nested lint evaluation preserves its parent's descriptor channel.
 *
 * The real ttsx config evaluator reports the selected import and missing
 * candidates in its own result. Its disposable loader must not append ambient
 * package probes to an already armed parent channel, including after a failed
 * config evaluation and recovery.
 *
 * 1. Evaluate an imported config under inactive and armed parent channels.
 * 2. Assert channel bytes, parent state and authoritative import fingerprints.
 * 3. Throw from the config, then restore it and verify healthy evaluation.
 *
 * @evidence contracts/testing.md#behavioral-verification The built lint factory invokes real ttsx and tsgo; parent channel bytes stay unchanged while selected import hashes and missing candidates remain in the descriptor before and after config failure.
 * @evidence contracts/testing.md#independent-expectations Authored sentinel bytes establish parent output, authored config and helper bytes establish their SHA256, and the deliberately absent selection.ts establishes a null fingerprint independently of descriptor output.
 * @evidence contracts/testing.md#distinguishing-cases Both inactive and already armed parent channels own healthy evaluation, a deliberate config exception and recovery; selected JavaScript and absent higher-priority TypeScript inputs distinguish isolation from discarded dependency evidence.
 * @evidence contracts/testing.md#execution-ownership This matching named native utility export executes the built factory and its real isolated config evaluator; it does not substitute a producer or patch a compiled export.
 * @evidence contracts/e2e.md#necessary-boundary Child environment inheritance and descriptor publication require the actual factory-to-ttsx-to-tsgo connection; a pure environment map cannot prove that bootstrap observations stay out of the parent channel.
 * @evidence contracts/e2e.md#shared-execution All calls reuse the current native compiler and built lint package without rebuilding Go or SDK inputs. Each parent-state fixture shares its selected helper across healthy, failing and recovered config evaluations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each channel state has a private TestProject-owned workspace and output file. Synchronous child lifetimes end before assertions and parent environment values are restored in finally. Recovered config bytes differ from the initial success, requiring a new evaluator instead of reuse of that successful cache entry.
 * @evidence contracts/e2e.md#preserved-coverage This new regression preserves actual selected-import and missing-candidate evidence while adding parent-channel ownership and exception recovery assertions; existing descriptor discovery and retarget cases remain unchanged.
 */
export function test_ttsc_lint_config_evaluator_keeps_bootstrap_out_of_the_parent_descriptor_channel(): void {
  const mod = TestProject.REQUIRE_FROM_TEST(
    path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
  );
  const factory = mod.createTtscPlugin ?? mod.default ?? mod;
  const filename = TestProject.REQUIRE_FROM_TEST.resolve(
    path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
  );
  const keys = [
    "TTSC_BINARY",
    "TTSC_TSGO_BINARY",
    "TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE",
    "TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT",
    "TTSC_PLUGIN_DESCRIPTOR_OUT",
    "TTSC_LOAD",
  ];
  const previous = keys.map((key) => process.env[key]);
  const failures: unknown[] = [];
  try {
    process.env.TTSC_BINARY = TestProject.NATIVE_BINARY;
    process.env.TTSC_TSGO_BINARY = TestProject.TSGO_BINARY;
    delete process.env.TTSC_PLUGIN_DESCRIPTOR_OUT;
    delete process.env.TTSC_LOAD;
    for (const active of ["0", "1"]) {
      try {
        const root = TestProject.physicalPath(
          TestProject.tmpdir("ttsc-lint-owned-config-channel-"),
        );
        const config = path.join(root, "lint.config.ts");
        const helper = path.join(root, "selection.js");
        const missing = path.join(root, "selection.ts");
        const channel = path.join(root, "parent-inputs.ndjson");
        const sentinel = JSON.stringify({ owner: "parent" }) + "\n";
        const helperSource = 'export default "warning";\n';
        const configSource = [
          'import severity from "./selection";',
          'export default { rules: { "no-var": severity } };',
          "",
        ].join("\n");
        fs.writeFileSync(
          path.join(root, "package.json"),
          JSON.stringify({ type: "module" }),
        );
        fs.writeFileSync(helper, helperSource);
        fs.writeFileSync(config, configSource);
        fs.writeFileSync(channel, sentinel);
        process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE = active;
        process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT = channel;
        const context = {
          binary: TestProject.NATIVE_BINARY,
          cwd: root,
          dirname: path.dirname(filename),
          filename,
          plugin: { configFile: config, transform: "@ttsc/lint" },
          pluginConfigDir: root,
          projectRoot: root,
          tsconfig: path.join(root, "tsconfig.json"),
        };
        const assertChannel = (): void => {
          assert.equal(fs.readFileSync(channel, "utf8"), sentinel);
          assert.equal(process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE, active);
          assert.equal(process.env.TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT, channel);
        };
        for (const phase of ["initial", "recovered"]) {
          const descriptor = factory(context);
          assertChannel();
          assert.ok(descriptor.hostInputs.includes(config));
          assert.equal(
            descriptor.hostInputHashes[config],
            crypto
              .createHash("sha256")
              .update(
                configSource +
                  (phase === "recovered" ? "// recovered evaluation\n" : ""),
              )
              .digest("hex"),
          );
          assert.equal(
            descriptor.hostInputRealpaths[config],
            fs.realpathSync.native(config),
          );
          assert.ok(descriptor.hostInputs.includes(helper));
          assert.equal(
            descriptor.hostInputHashes[helper],
            crypto.createHash("sha256").update(helperSource).digest("hex"),
          );
          assert.equal(
            descriptor.hostInputRealpaths[helper],
            fs.realpathSync.native(helper),
          );
          assert.ok(descriptor.hostInputs.includes(missing));
          assert.equal(descriptor.hostInputHashes[missing], null);
          assert.equal(descriptor.hostInputRealpaths[missing], null);
          for (const input of descriptor.hostInputs)
            assert.ok(Object.hasOwn(descriptor.hostInputHashes, input));
          if (phase === "initial") {
            fs.writeFileSync(config, 'throw new Error("owned config failure");\n');
            assert.throws(() => factory(context), /owned config failure/);
            assertChannel();
            fs.writeFileSync(config, configSource + "// recovered evaluation\n");
          }
        }
      } catch (error) {
        failures.push(error);
      }
    }
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
  if (failures.length)
    throw new AggregateError(failures, "lint evaluator channel controls failed");
}
