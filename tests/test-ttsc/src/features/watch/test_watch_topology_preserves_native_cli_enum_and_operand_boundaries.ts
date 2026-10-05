import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

type ExpectedReports = readonly [
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
];
type Profile = {
  name: string;
  configuredJsx?: string;
  passthrough: readonly string[];
  sourceMap: boolean;
  expected: ExpectedReports;
  targetCount?: 4 | 6;
};

const FILENAMES = [
  "view.jsx",
  "view.js",
  "view.jsx.map",
  "view.js.map",
  "view.d.ts",
  "view.d.ts.map",
] as const;
const PRESERVE: ExpectedReports = [false, true, false, true, true, true];
const NON_PRESERVE: ExpectedReports = [true, false, true, false, true, true];
const PRESERVE_WITHOUT_MAP: ExpectedReports = [
  false,
  true,
  true,
  true,
  true,
  true,
];

/**
 * Verifies CLI enum normalization and operand consumption in configured watch
 * output decisions without changing JSON's whitespace policy.
 *
 * The pinned native scalar CLI enum reader trims its IsWhiteSpaceLike set and
 * lowercases the value. JSON enum conversion lowercases without that trim.
 * Native scalar path options consume their next token even when it looks like
 * another flag. Those independently read rules determine the literal callback
 * expectations below; topology state never supplies an expected output.
 *
 * 1. Run 81 CLI and 81 JSON padded-value profiles plus seven controls.
 * 2. Retain eight uppercase, raw-JSON and consumed-operand profiles.
 * 3. Retain configured preserve plus explicit-null and trimmed-empty clears.
 * 4. Edit declared output/non-output twins and collect every named failure.
 *
 * Native ordinary compile/build merge applies explicit null as SetZero, and CLI
 * trim-empty enum conversion produces nil without a diagnostic. Those rules
 * determine the effective source watch option decision; no native watcher raw
 * refresh or compiler execution is claimed. Plain TSX source excludes an
 * unrelated JSX-syntax diagnostic from these callback decisions.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source WatchTopology consumes real configs, supplied absolute compiler membership and the source directory adapter. Public project callbacks must report the authored non-output twins and suppress the authored products for CLI enum, JSON enum, prior-path-operand and explicit-clear decisions.
 * @evidence contracts/testing.md#independent-expectations Literal JSX/map report vectors and six-file declaration controls follow pinned native commandlineparser.go scalar operand/enum conversion, stringutil/util.go's exact 27 codepoints and tsconfigparsing.go's untrimmed enum caller. Files, bytes and compiler membership are authored independently of inferred topology products.
 * @evidence contracts/testing.md#distinguishing-cases The 180 profiles retain all 27 native whitespace codepoints at left/right/both in CLI and JSON, normal and outside-set controls, valid uppercase/mixed JSON, raw padded JSON, explicit-null and trimmed-empty CLI clears, and rootDir operands named --jsx, --noEmit, --declaration and --sourceMap. Invalid JSON enum profiles observe raw source prediction only; they do not claim native compiler acceptance, successful compilation or actual emitted bytes.
 * @evidence contracts/testing.md#execution-ownership One temporary project runs 180 recorded source topologies through the existing owned compiler-input operation and recordWatchers/source-adapter callbacks. Compiler children, listFilesOnly processes, native observer subscriptions and SDK producers are zero. Real native population and OS notification transport remain owned by the canonical E2E; this unit never inspects private topology state or invents native plugin query receipts.
 */
export async function test_watch_topology_preserves_native_cli_enum_and_operand_boundaries(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-native-enum-operands-"),
  );
  const source = path.join(root, "view.tsx");
  fs.writeFileSync(source, "export const view = 1;\n", "utf8");
  const inputs = [source];
  const allTargets = FILENAMES.map((name) => path.join(root, name));
  const failures: Error[] = [];
  const profiles = authorProfiles();
  assert.equal(profiles.length, 180);

  for (const [index, profile] of profiles.entries()) {
    const fail = (name: string, cause: unknown): void => {
      failures.push(new Error(`${profile.name}: ${name}`, { cause }));
    };
    const targets = allTargets.slice(0, profile.targetCount ?? 4);
    const changes: WatchInputChange[] = [];
    const observed = recordWatchers(watchDirectoryThroughFsWatch);
    const topology = new WatchTopology(
      {
        cwd: root,
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
        files: [],
        emit: true,
        passthrough: profile.passthrough,
      },
      {
        onError: (location, error) => fail(`watch error on ${location}`, error),
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      observed.openDirectoryWatch,
      observed.openFileWatch,
      fs.readdirSync,
      (project, options) => {
        assert.equal(project.root, root, profile.name);
        assert.deepEqual(options.files, [], profile.name);
        return inputs;
      },
    );
    try {
      for (const target of targets)
        fs.writeFileSync(target, `initial:${index}`, "utf8");
      writeConfig(root, profile);
      topology.refresh(false);
      topology.setProjectInputs({ root, files: targets, globs: [] });
      await settleWatchEvents();

      for (const [targetIndex, target] of targets.entries()) {
        try {
          const previous = changes.length;
          fs.writeFileSync(
            target,
            `changed:${index}:${FILENAMES[targetIndex]}`,
            "utf8",
          );
          deliverWatchEvent(observed.watchers, target, "change");
          // The recorded adapter and this source lane have no native delayed
          // delivery. Flush their queued reconciliation before deciding a twin.
          await settleWatchEvents();
          const reports = changes
            .slice(previous)
            .filter((change) => change.kind === "project");
          assert.equal(
            reports.length !== 0,
            profile.expected[targetIndex],
            `${profile.name}: ${FILENAMES[targetIndex]}`,
          );
          if (profile.expected[targetIndex])
            assert.ok(
              reports.every((change) => change.path === target),
              `${profile.name}: callback names the authored changed path`,
            );
        } catch (error) {
          fail(FILENAMES[targetIndex]!, error);
        }
      }
      assert.deepEqual(
        inputs,
        [source],
        "compiler membership remains caller-owned",
      );
    } catch (error) {
      fail("setup or membership", error);
    } finally {
      topology.close();
      try {
        assert.ok(
          observed.watchers.every((watcher) => watcher.active === false),
        );
      } catch (error) {
        fail("observer retirement", error);
      }
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "native CLI enum/operand watch matrix failed",
    );
}

function authorProfiles(): Profile[] {
  const profiles: Profile[] = [
    {
      name: "normal CLI preserve",
      passthrough: ["--jsx", "preserve"],
      sourceMap: true,
      expected: PRESERVE,
    },
    {
      name: "normal JSON preserve",
      configuredJsx: "preserve",
      passthrough: [],
      sourceMap: true,
      expected: PRESERVE,
    },
  ];
  // Exact pinned native IsWhiteSpaceLike switch plus its four line breaks.
  // U+0085 and U+200B intentionally distinguish this set from JavaScript trim.
  const whitespace = [
    0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x0085, 0x00a0, 0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008,
    0x2009, 0x200a, 0x200b, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ] as const;
  for (const codepoint of whitespace) {
    const padding = String.fromCodePoint(codepoint);
    const identity = `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
    for (const side of ["left", "right", "both"] as const) {
      const value =
        (side === "left" || side === "both" ? padding : "") +
        "preserve" +
        (side === "right" || side === "both" ? padding : "");
      profiles.push(
        {
          name: `CLI ${identity} ${side}`,
          passthrough: ["--jsx", value],
          sourceMap: true,
          expected: PRESERVE,
        },
        {
          name: `raw JSON ${identity} ${side}`,
          configuredJsx: value,
          passthrough: [],
          sourceMap: true,
          expected: NON_PRESERVE,
        },
      );
    }
  }
  for (const codepoint of [0x0000, 0x0008, 0x001c, 0x180e, 0x2060]) {
    const padding = String.fromCodePoint(codepoint);
    profiles.push({
      name: `outside native trim U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`,
      passthrough: ["--jsx", `${padding}preserve${padding}`],
      sourceMap: true,
      expected: NON_PRESERVE,
    });
  }
  profiles.push(
    {
      name: "uppercase CLI positive",
      targetCount: 6,
      passthrough: ["--jsx", "PRESERVE"],
      sourceMap: true,
      expected: PRESERVE,
    },
    {
      name: "uppercase JSON positive",
      targetCount: 6,
      configuredJsx: "PRESERVE",
      passthrough: [],
      sourceMap: true,
      expected: PRESERVE,
    },
    {
      name: "mixed-case JSON positive",
      targetCount: 6,
      configuredJsx: "PrEsErVe",
      passthrough: [],
      sourceMap: true,
      expected: PRESERVE,
    },
    {
      name: "padded uppercase JSON stays raw",
      targetCount: 6,
      configuredJsx: " PRESERVE ",
      passthrough: [],
      sourceMap: true,
      expected: NON_PRESERVE,
    },
    {
      name: "rootDir consumes JSX-shaped operand",
      targetCount: 6,
      configuredJsx: "preserve",
      passthrough: ["--rootDir", "--jsx", "--sourceMap"],
      sourceMap: true,
      expected: PRESERVE,
    },
    {
      name: "rootDir consumes noEmit-shaped operand",
      targetCount: 6,
      configuredJsx: "preserve",
      passthrough: ["--rootDir", "--noEmit", "--sourceMap"],
      sourceMap: true,
      expected: PRESERVE,
    },
    {
      name: "rootDir consumes declaration-shaped operand",
      targetCount: 6,
      configuredJsx: "preserve",
      passthrough: ["--rootDir", "--declaration", "--sourceMap"],
      sourceMap: true,
      expected: PRESERVE,
    },
    {
      name: "rootDir consumes sourceMap-shaped operand",
      targetCount: 6,
      configuredJsx: "preserve",
      passthrough: ["--rootDir", "--sourceMap", "--jsx", "preserve"],
      sourceMap: false,
      expected: PRESERVE_WITHOUT_MAP,
    },
  );
  profiles.push(
    {
      name: "configured preserve clear baseline",
      configuredJsx: "preserve",
      passthrough: [],
      sourceMap: true,
      expected: PRESERVE,
    },
    {
      name: "explicit CLI null clears configured preserve",
      configuredJsx: "preserve",
      passthrough: ["--jsx", "null"],
      sourceMap: true,
      expected: NON_PRESERVE,
    },
    {
      name: "CLI trim-empty clears configured preserve",
      configuredJsx: "preserve",
      passthrough: ["--jsx", " "],
      sourceMap: true,
      expected: NON_PRESERVE,
    },
  );
  return profiles;
}

function writeConfig(root: string, profile: Profile): void {
  // Escapes preserve the decoded scalar while keeping U+2028/U+2029 out of the
  // JSON source's lexical line-break boundary. JSON enum whitespace stays raw.
  const text = JSON.stringify({
    compilerOptions: {
      sourceMap: profile.sourceMap,
      ...(profile.configuredJsx === undefined
        ? {}
        : { jsx: profile.configuredJsx }),
    },
    files: ["view.tsx"],
  })
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  fs.writeFileSync(path.join(root, "tsconfig.json"), text, "utf8");
}
