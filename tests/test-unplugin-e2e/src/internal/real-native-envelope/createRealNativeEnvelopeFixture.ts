import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import type { IRealNativeEnvelopeFixture } from "./IRealNativeEnvelopeFixture";

interface IRealNativeEnvelopeFixtureOptions {
  /** Stage config and declaration races across consecutive compile attempts. */
  raceInputsAcrossAttempts?: boolean;
  /** Include the full resolver-owner and module-suffix probe corpus. */
  resolutionCorpus?: boolean;
}

let sharedContributorRoot: string | undefined;

/**
 * Materialize a package-resolution fixture driven by ttsc's utility host.
 *
 * The Go package is deliberately not `main`: ttsc copies it into the ordinary
 * utility host as a linked contributor, whose no-op `ApplyProgram` method runs
 * in the same native invocation that produces `driver.NewTransformGraph`.
 */
export function createRealNativeEnvelopeFixture(
  options: IRealNativeEnvelopeFixtureOptions = {},
): IRealNativeEnvelopeFixture {
  TestUnpluginProject.ensureSharedCacheDir();
  const resolutionCorpus = options.resolutionCorpus === true;
  const root = TestProject.tmpdir("ttsc-unplugin-RealEnvelope-");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-real-envelope-log-"),
    "program-runs.bin",
  );
  const modules = [
    ...Array.from({ length: 4 }, (_, index) =>
      path.join(root, "src", `mod${index}.ts`),
    ),
    path.join(root, "src", "predicate.cts"),
  ];
  const declaration = path.join(
    root,
    "node_modules",
    "typed-dep",
    "dist",
    "index.d.ts",
  );
  const excludedDirectory =
    options.raceInputsAcrossAttempts === true ? "generated-next" : "generated";
  const excludedSource = path.join(
    root,
    "src",
    excludedDirectory,
    "ignored.ts",
  );
  const missingCandidate = path.join(
    root,
    "node_modules",
    "linked-pkg",
    "index.ts",
  );
  const fileCandidateDirectory = path.join(root, "node_modules", "punycode.js");
  const automaticTypesDirectory = path.join(root, "node_modules", "@types");
  const resolutionCandidateGroups: Record<string, string[]> = resolutionCorpus
    ? {
        "package exports subpath": [
          path.join(
            root,
            "node_modules",
            "exports-pkg",
            "dist",
            "feature.native.ts",
          ),
        ],
        "package main target": [
          path.join(root, "node_modules", "linked-pkg", "index.native.ts"),
        ],
        "package types target": [
          path.join(
            root,
            "node_modules",
            "typed-dep",
            "dist",
            "index.native.d.ts",
          ),
        ],
        paths: [path.join(root, "paths", "value.native.ts")],
        relative: [
          path.join(root, "src", "relative.native.ts"),
          path.join(root, "src", "relative.ts"),
          path.join(root, "src", "relative.native.tsx"),
          path.join(root, "src", "relative.tsx"),
          path.join(root, "src", "relative.native.d.ts"),
          path.join(root, "src", "relative.d.ts"),
          path.join(root, "src", "relative.native.js"),
          path.join(root, "src", "react.native.tsx"),
          path.join(root, "src", "react.tsx"),
          path.join(root, "src", "react.native.ts"),
          path.join(root, "src", "react.ts"),
          path.join(root, "src", "react.native.d.ts"),
          path.join(root, "src", "react.d.ts"),
          path.join(root, "src", "react.native.jsx"),
          path.join(root, "src", "esm.native.mts"),
          path.join(root, "src", "esm.mts"),
          path.join(root, "src", "esm.native.d.mts"),
          path.join(root, "src", "esm.d.mts"),
          path.join(root, "src", "esm.native.mjs"),
          path.join(root, "src", "common.native.cts"),
          path.join(root, "src", "common.cts"),
          path.join(root, "src", "common.native.d.cts"),
          path.join(root, "src", "common.d.cts"),
          path.join(root, "src", "common.native.cjs"),
        ],
        rootDirs: [
          path.join(root, "src", "rooted.native.ts"),
          path.join(root, "generated", "rooted.native.ts"),
        ],
      }
    : {};

  TestProject.writeFiles(root, {
    "go.mod": "module example.com/ttscunpluginrealenvelope\n\ngo 1.26\n",
    "package.json": JSON.stringify({ private: true, type: "module" }, null, 2),
    "compile-probe/probe.go": [
      "package cacheprobe",
      "",
      "import (",
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      "",
      '  "github.com/samchon/ttsc/packages/ttsc/driver"',
      ")",
      "",
      "type plugin struct{}",
      "",
      "func (plugin) ApplyProgram(_ *driver.Program, context driver.PluginContext) error {",
      '  runLog, ok := context.Entry.Config["runLog"].(string)',
      '  if !ok || runLog == "" {',
      '    return fmt.Errorf("real-envelope compile probe requires a runLog string")',
      "  }",
      "  if !filepath.IsAbs(runLog) {",
      "    runLog = filepath.Join(context.Cwd, runLog)",
      "  }",
      "  file, err := os.OpenFile(runLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)",
      "  if err != nil {",
      "    return err",
      "  }",
      "  info, err := file.Stat()",
      "  if err != nil {",
      "    _ = file.Close()",
      "    return err",
      "  }",
      "  attempt := info.Size()",
      "  if _, err := file.Write([]byte{1}); err != nil {",
      "    _ = file.Close()",
      "    return err",
      "  }",
      "  if err := file.Close(); err != nil {",
      "    return err",
      "  }",
      '  raceAttempt, _ := context.Entry.Config["raceAttempt"].(float64)',
      "  if attempt == int64(raceAttempt) {",
      '    raceFile, _ := context.Entry.Config["raceFile"].(string)',
      '    raceContent, _ := context.Entry.Config["raceContent"].(string)',
      '    if raceFile != "" && raceContent != "" {',
      "      if !filepath.IsAbs(raceFile) {",
      "        raceFile = filepath.Join(context.Cwd, raceFile)",
      "      }",
      "      if err := os.WriteFile(raceFile, []byte(raceContent), 0o644); err != nil {",
      "        return err",
      "      }",
      "    }",
      "  }",
      "  return nil",
      "}",
      "",
      "func init() {",
      "  driver.RegisterPlugin(plugin{})",
      "}",
      "",
    ].join("\n"),
    "tsconfig.json": JSON.stringify(
      {
        extends: "./presets/base.json",
        compilerOptions: {
          allowJs: true,
          module: "NodeNext",
          moduleResolution: "NodeNext",
          moduleSuffixes: [".native", ""],
          noImplicitAny: false,
          plugins: [
            {
              name: "real-envelope-compile-probe",
              raceAttempt:
                options.raceInputsAcrossAttempts === true ? 99 : undefined,
              raceContent:
                options.raceInputsAcrossAttempts === true
                  ? "export interface Shared { label: string; revision?: number; }\n"
                  : undefined,
              raceFile:
                options.raceInputsAcrossAttempts === true
                  ? declaration
                  : undefined,
              runLog,
              transform: "./plugin.cjs",
            },
          ],
          ...(resolutionCorpus
            ? {
                jsx: "preserve",
                paths: { "@fixture/value": ["./paths/value"] },
                rootDirs: ["src", "generated"],
              }
            : {}),
          strict: true,
          target: "ES2022",
          // #1353: @types primary lookup hides a lowercased synthetic
          // containing file. A package subpath exercises secondary lookup
          // through the real host, including generated compiler overlays.
          types: ["*", "envelope-client/client"],
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "presets/base.json": JSON.stringify({
      compilerOptions: {
        outDir: "${configDir}\\src\\generated",
        rootDir: "${configDir}",
      },
    }),
    [`src/${excludedDirectory}/ignored.ts`]:
      'export const ignored = "the templated outDir excludes this source";\n',
    "node_modules/typed-dep/package.json": JSON.stringify(
      {
        main: "dist/index.js",
        name: "typed-dep",
        type: "module",
        types: "dist/index.d.ts",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "node_modules/typed-dep/dist/index.d.ts":
      "export interface Shared { label: string; }\n",
    "node_modules/typed-dep/dist/index.js": 'export const runtime = "typed";\n',
    "node_modules/@types/fixture-types/index.d.ts":
      "declare const realEnvelopeFixtureGlobal: string;\n",
    "node_modules/envelope-client/package.json": JSON.stringify({
      exports: { "./client": "./client.d.ts" },
      name: "envelope-client",
      version: "1.0.0",
    }),
    "node_modules/envelope-client/client.d.ts":
      "declare const realEnvelopeClientGlobal: string;\n",
    ...(resolutionCorpus
      ? {
          "node_modules/linked-pkg/package.json": JSON.stringify(
            {
              main: "index.js",
              name: "linked-pkg",
              type: "module",
              version: "0.0.0",
            },
            null,
            2,
          ),
          "node_modules/linked-pkg/index.d.ts":
            "export declare const linked: string;\n",
          "node_modules/linked-pkg/index.js": 'export const linked = "js";\n',
          "node_modules/exports-pkg/package.json": JSON.stringify(
            {
              exports: { "./feature": "./dist/feature.js" },
              name: "exports-pkg",
              type: "module",
              version: "0.0.0",
            },
            null,
            2,
          ),
          "node_modules/exports-pkg/dist/feature.js":
            'export const feature = "exports";\n',
          "generated/rooted.js": 'export const rooted = "rootDirs";\n',
          "paths/value.js": 'export const pathValue = "paths";\n',
          "src/esm.mjs": 'export const esm = "mjs";\n',
          "src/react.jsx": 'export const jsx = "jsx";\n',
          "src/relative.js": 'export const relative = "relative";\n',
        }
      : {}),
    "node_modules/punycode/package.json": JSON.stringify(
      {
        main: "punycode.js",
        name: "punycode",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "node_modules/punycode/punycode.js":
      "module.exports = { encode(value) { return value; } };\n",
    "node_modules/punycode.js/package.json": JSON.stringify(
      {
        main: "punycode.js",
        name: "punycode.js",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "node_modules/punycode.js/punycode.js":
      "module.exports = { encode(value) { return `other:${value}`; } };\n",
    "src/common.cjs": 'exports.common = "cjs";\n',
    ...Object.fromEntries(
      modules.map((file, index) => [
        path.relative(root, file),
        file.endsWith(".cts")
          ? [
              'import { common } from "./common.cjs";',
              ...(resolutionCorpus
                ? ['import { pathValue } from "@fixture/value";']
                : []),
              'import { encode } from "punycode";',
              "",
              `export const predicate = encode("proof") + common${resolutionCorpus ? " + pathValue" : ""};`,
              "",
            ].join("\n")
          : [
              'import type { Shared } from "typed-dep";',
              ...(resolutionCorpus
                ? [
                    'import { linked } from "linked-pkg";',
                    ...(index === 0
                      ? [
                          'import { esm } from "./esm.mjs";',
                          'import { relative } from "./relative.js";',
                        ]
                      : []),
                    ...(index === 2
                      ? ['import { rooted } from "./rooted.js";']
                      : []),
                    ...(index === 3
                      ? [
                          'import { feature } from "exports-pkg/feature";',
                          'import { jsx } from "./react.jsx";',
                        ]
                      : []),
                  ]
                : []),
              "",
              resolutionCorpus
                ? `export const value${index}: Shared = { label: [linked, ${JSON.stringify(String(index))}${index === 0 ? ", esm, relative" : index === 2 ? ", rooted" : index === 3 ? ", feature, jsx" : ""}].join(":") };`
                : `export const value${index}: Shared = { label: ${JSON.stringify(String(index))} };`,
              "",
            ].join("\n"),
      ]),
    ),
  });
  const contributorRoot = sharedRealNativeContributor(root);
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    [
      "module.exports = (context) => ({",
      '  name: context.plugin.name ?? "real-envelope-compile-probe",',
      `  source: ${JSON.stringify(contributorRoot)},`,
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  return {
    automaticTypesDirectory,
    declaration,
    excludedSource,
    fileCandidateDirectory,
    missingCandidate,
    modules,
    resolutionCorpus,
    resolutionCandidateGroups,
    root,
    runLog,
  };
}

function sharedRealNativeContributor(root: string): string {
  sharedContributorRoot ??= path.join(
    TestUnpluginProject.materializeSharedSource(
      "real-native-envelope-module",
      (moduleRoot) => {
        fs.writeFileSync(
          path.join(moduleRoot, "go.mod"),
          "module example.com/ttscunpluginrealenvelope\n\ngo 1.26\n",
          "utf8",
        );
        const contributor = path.join(moduleRoot, "compile-probe");
        fs.mkdirSync(contributor, { recursive: true });
        fs.copyFileSync(
          path.join(root, "compile-probe", "probe.go"),
          path.join(contributor, "probe.go"),
        );
      },
    ),
    "compile-probe",
  );
  return sharedContributorRoot;
}
