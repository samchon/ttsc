import { TestProject } from "@ttsc/testing";
import childProcess from "node:child_process";

import {
  COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE,
  assert,
  fs,
  path,
} from "../../internal/project";

/** A descriptor dependency changed A-B-A while loading must lose cache proof. */
export const test_commonjs_plugin_descriptor_aba_omits_stale_hash_proof =
  (): void => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-descriptor-aba-"),
    );
    const dependency = path.join(root, "selection.cjs");
    const descriptor = path.join(root, "plugin.cjs");
    const output = path.join(root, "descriptor.json");
    const before = 'module.exports = { name: "before", source: "before" };\n';
    const during = 'module.exports = { name: "during", source: "during" };\n';
    fs.writeFileSync(dependency, before, "utf8");
    fs.writeFileSync(
      descriptor,
      [
        'const fs = require("node:fs");',
        'const { registerHooks } = require("node:module");',
        'const { pathToFileURL } = require("node:url");',
        `const dependency = ${JSON.stringify(dependency)};`,
        `const during = ${JSON.stringify(during)};`,
        `const before = ${JSON.stringify(before)};`,
        "registerHooks({",
        "  load(url, context, nextLoad) {",
        "    if (url !== pathToFileURL(dependency).href) return nextLoad(url, context);",
        "    fs.writeFileSync(dependency, during, 'utf8');",
        "    try { return nextLoad(url, context); }",
        "    finally { fs.writeFileSync(dependency, before, 'utf8'); }",
        "  },",
        "});",
        "module.exports = () => require(dependency);",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = childProcess.spawnSync(
      process.execPath,
      ["-e", COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          TTSC_PLUGIN_CONTEXT: JSON.stringify({}),
          TTSC_PLUGIN_DESCRIPTOR_OUT: output,
          TTSC_PLUGIN_ENTRY: descriptor,
        },
        windowsHide: true,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(fs.readFileSync(output, "utf8")) as {
      descriptor: { name: string };
      inputHashes: Record<string, string | null>;
      inputs: string[];
    };
    assert.equal(payload.descriptor.name, "during");
    assert.equal(fs.readFileSync(dependency, "utf8"), before);
    assert.ok(payload.inputs.includes(dependency));
    assert.equal(
      Object.prototype.hasOwnProperty.call(payload.inputHashes, dependency),
      false,
      "an A-B-A input must stay watched without certifying the B result as A",
    );
  };
