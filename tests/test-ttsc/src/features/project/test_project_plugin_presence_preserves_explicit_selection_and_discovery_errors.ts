import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { hasProjectPluginEntries } from "../../../../../packages/ttsc/src/plugin/internal/load/hasProjectPluginEntries";
import type { ITtscProjectPluginConfig } from "../../../../../packages/ttsc/src/structures/ITtscProjectPluginConfig";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies explicit plugin selection and current discovery preserve presence.
 *
 * A malformed automatic marker distinguishes bypassing discovery from hiding
 * its error. Presence resolves metadata but must not evaluate a descriptor.
 * Full project records come from the actual owned config reader.
 *
 * 1. Require false, empty and all-disabled explicit inputs to remain absent,
 *    and mixed or implicitly enabled inputs to remain present.
 * 2. Resolve omitted inputs from configured and automatic entries, including
 *    ordinary absence and disabled automatic markers.
 * 3. Require malformed automatic markers to throw their literal diagnostics.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual hasProjectPluginEntries export consumes full readProjectConfig results and native temporary manifests. Explicit selections bypass an automatic marker that throws when omitted; configured and discovered enabled entries return true without descriptor execution, and malformed discovered markers remain errors.
 * @evidence contracts/testing.md#independent-expectations Literal false/true outcomes follow explicit disable, enabled-not-false selection and declared automatic marker semantics. Literal attributed marker diagnostics distinguish resolver errors from fabricated absence; no resolver output or duplicate selector produces expectations.
 * @evidence contracts/testing.md#distinguishing-cases Covers explicit false, empty, all-disabled, mixed false/true and missing enabled; omitted empty, configured, automatic enabled and automatic disabled populations; null marker and empty transform refusals. A descriptor file throws if evaluated, so accepted discovery distinguishes metadata presence from descriptor loading. Independent rows retain named failures.
 * @evidence contracts/testing.md#execution-ownership A selectable direct source unit uses owned temporary config and package files without installation, compiler, native build, descriptor evaluation or product host. readProjectConfig supplies the supported complete project DTO; no synthetic cast, foreign patch or new API seam is used.
 */
export function test_project_plugin_presence_preserves_explicit_selection_and_discovery_errors(): void {
  const failures: Error[] = [];
  const cases: {
    name: string;
    configured?: ITtscProjectPluginConfig[];
    explicit?: readonly ITtscProjectPluginConfig[] | false;
    marker?: { plugin: unknown };
    expected?: boolean;
    error?: string;
  }[] = [
    {
      name: "explicit false bypasses malformed discovery",
      explicit: false,
      marker: { plugin: null },
      expected: false,
    },
    {
      name: "explicit empty bypasses malformed discovery",
      explicit: [],
      marker: { plugin: null },
      expected: false,
    },
    {
      name: "all explicit entries disabled",
      explicit: [{ enabled: false }, { enabled: false }],
      marker: { plugin: null },
      expected: false,
    },
    {
      name: "mixed explicit entries enabled",
      explicit: [{ enabled: false }, { enabled: true }],
      marker: { plugin: null },
      expected: true,
    },
    {
      name: "omitted enabled is present",
      explicit: [{ enabled: false }, {}],
      marker: { plugin: null },
      expected: true,
    },
    { name: "omitted entries and no declarations", expected: false },
    {
      name: "omitted entries retain configured presence",
      configured: [
        { transform: "./descriptor.cjs", enabled: false },
        { transform: "./descriptor.cjs" },
      ],
      expected: true,
    },
    {
      name: "omitted entries discover an enabled marker",
      marker: { plugin: { transform: "./descriptor.cjs" } },
      expected: true,
    },
    {
      name: "omitted entries ignore a disabled marker",
      marker: { plugin: { transform: "./descriptor.cjs", enabled: false } },
      expected: false,
    },
    {
      name: "malformed automatic marker remains an error",
      marker: { plugin: null },
      error: 'ttsc: package "owned-plugin" declares invalid "ttsc.plugin"; expected an object',
    },
    {
      name: "empty automatic transform remains an error",
      marker: { plugin: { transform: "" } },
      error: 'ttsc: package "owned-plugin" declares invalid "ttsc.plugin.transform"; expected a non-empty string',
    },
  ];
  for (const scenario of cases) {
    try {
      const root = TestProject.physicalPath(
        TestProject.tmpdir("ttsc-plugin-presence-"),
      );
      const config = path.join(root, "tsconfig.json");
      fs.writeFileSync(
        config,
        JSON.stringify({ compilerOptions: { plugins: scenario.configured ?? [] } }),
        "utf8",
      );
      fs.writeFileSync(
        path.join(root, "descriptor.cjs"),
        'throw new Error("presence evaluated the configured descriptor");\n',
        "utf8",
      );
      fs.writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "owned-consumer",
          private: true,
          dependencies:
            scenario.marker === undefined ? {} : { "owned-plugin": "1.0.0" },
        }),
        "utf8",
      );
      if (scenario.marker !== undefined) {
        const dependency = path.join(root, "node_modules", "owned-plugin");
        fs.mkdirSync(dependency, { recursive: true });
        fs.writeFileSync(
          path.join(dependency, "package.json"),
          JSON.stringify({ name: "owned-plugin", ttsc: scenario.marker }),
          "utf8",
        );
        fs.writeFileSync(
          path.join(dependency, "descriptor.cjs"),
          'throw new Error("presence evaluated the automatic descriptor");\n',
          "utf8",
        );
      }
      const project = readProjectConfig({ cwd: root, tsconfig: config });
      if (scenario.error !== undefined) {
        assert.throws(
          () => hasProjectPluginEntries(project),
          { message: scenario.error },
          scenario.name,
        );
      } else {
        assert.equal(
          hasProjectPluginEntries(project, scenario.explicit),
          scenario.expected,
          scenario.name,
        );
      }
    } catch (error) {
      failures.push(new Error(scenario.name, { cause: error }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "project plugin presence scenarios failed");
}
