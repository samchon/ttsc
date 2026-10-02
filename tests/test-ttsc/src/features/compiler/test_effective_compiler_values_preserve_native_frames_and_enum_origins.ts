import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { CompilerArgumentsInspection } from "../../../../../packages/ttsc/src/compiler/internal/CompilerArgumentsInspection";
import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../../../../packages/ttsc/src/compiler/internal/readEffectiveCompilerOptions";
import { readCompilerOptionValues } from "../../../../../packages/ttsc/src/flags/readCompilerOptionValues";
import { resolveSingleFileOutput } from "../../../../../packages/ttsc/src/launcher/internal/resolveSingleFileOutput";
import { RuntimeModuleFormat } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeModuleFormat";
import { runtimeCompilerArgs } from "../../../../../packages/ttsc/src/launcher/internal/runtimeCompilerArgs";
import { runtimeEmitProfile } from "../../../../../packages/ttsc/src/launcher/internal/runtimeEmitProfile";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies native argv frames and enum origins reach actual launcher decisions.
 *
 * The pinned parser's IsWhiteSpaceLike domain and literal compiler settings are
 * independent expectations. Temporary authored config files feed the real
 * positional resolver; runtime policy and module classification use their real
 * effective reader. The actual safety inspector tokenizes one authored response
 * file and records its observation. Unsafe response extensions fail inspection
 * before compiler selection; absent binary paths are independent controls.
 * No native compiler expansion is executed.
 *
 * 1. Collect every native-padding case across five downstream decisions.
 * 2. Distinguish CLI normalization from JSON data, Unicode folds and resets.
 * 3. Preserve scalar operands, ordered assignments and caller-owned inputs.
 * 4. Inspect one actual response frame and reject unsafe trailing extensions.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual effective reader, runtime arguments/profile, module classifier and positional output resolver preserve native frames and enum origins. Scalar @data remains an operand; CompilerArgumentsInspection tokenizes an authored response file into a literal vector and records one observation. Unsafe trailing response extensions return null with unchanged argv and no available native compiler; actual native expansion is unobserved.
 * @evidence contracts/testing.md#independent-expectations Literal native whitespace code points, authored commonjs/ESNext/JSX settings, native simple İ-to-i folding and ordinary CLI null/empty reset semantics define expected formats, suffixes and runtime overrides independently of generated metadata or product outputs.
 * @evidence contracts/testing.md#distinguishing-cases All 27 native whitespace characters on either or both sides, raw JSON whitespace, leading-dash invalid values, Unicode native folding, absence versus null and empty resets, repeated assignments, aliases, config-only rejected assignments, dash/@ scalar operands and genuine response frames distinguish the verified causes. Every observation is collected before failure is reported.
 * @evidence contracts/testing.md#execution-ownership This source unit invokes authored operations and reads real temporary config/source/response files in one process. The two selected native binary paths are independently absent; it starts no compiler, consumer host, SDK build or OS observer. Existing watch units and native boundary cases retain event delivery and compiler integration ownership.
 */
export function test_effective_compiler_values_preserve_native_frames_and_enum_origins(): void {
  const failures: unknown[] = [];
  const observe = (label: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    }
  };
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-effective-enum-origin-"),
  );
  for (const binary of ["absent-native-binary", "unavailable-compiler"])
    assert.equal(fs.existsSync(path.join(root, binary)), false);
  const config = path.join(root, "tsconfig.json");
  const view = path.join(root, "view.tsx");
  const filename = path.join(root, "--module", "main.ts");
  fs.mkdirSync(path.dirname(filename));
  fs.writeFileSync(filename, "export const value = 1;\n");
  fs.writeFileSync(view, "export const value = 1;\n");
  fs.writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: {
        module: "commonjs",
        target: "es2025",
        jsx: "react",
        lib: ["es2025"],
      },
      files: ["view.tsx", "--module/main.ts"],
    }),
  );
  const project = readProjectConfig({ cwd: root, tsconfig: config });
  const configured = JSON.stringify(project.compilerOptions);
  // Primary native stringutil.IsWhiteSpaceLike; not read from generated tables.
  const whitespace = [
    0x9, 0xa, 0xb, 0xc, 0xd, 0x20, 0x85, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002,
    0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x200b,
    0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ];
  for (const code of whitespace)
    for (const side of ["left", "right", "both"]) {
      const character = String.fromCodePoint(code);
      const padded = (word: string): string =>
        (side !== "right" ? character : "") +
        word +
        (side !== "left" ? character : "");
      observe(`module ${code}/${side}`, () => {
        const args = Object.freeze(["--module", padded("COMMONJS")]);
        assert.equal(
          RuntimeModuleFormat.moduleFormat(
            filename,
            runtimeEmitProfile(project, args).moduleOptions,
          ),
          "commonjs",
        );
      });
      observe(`positional JSX ${code}/${side}`, () => {
        assert.equal(
          path.extname(
            resolveSingleFileOutput({
              cwd: root,
              file: view,
              tsconfig: config,
              passthrough: ["--jsx", padded("PRESERVE")],
            }),
          ),
          ".jsx",
        );
      });
      for (const jsx of ["PRESERVE", "REACT-NATIVE"])
        observe(`runtime ${jsx} ${code}/${side}`, () => {
          const args = Object.freeze(["--jsx", padded(jsx)]);
          assert.deepEqual(runtimeCompilerArgs(project, args), [
            ...args,
            "--jsx",
            "react-jsx",
            "--noEmit",
            "false",
            "--emitDeclarationOnly",
            "false",
          ]);
        });
      observe(`runtime target ${code}/${side}`, () => {
        const args = Object.freeze(["--target", padded("ESNEXT")]);
        assert.deepEqual(runtimeCompilerArgs(project, args), [
          ...args,
          "--target",
          "es2025",
          "--noEmit",
          "false",
          "--emitDeclarationOnly",
          "false",
        ]);
      });
      observe(`JSON keeps whitespace ${code}/${side}`, () => {
        const raw = padded("COMMONJS");
        assert.equal(
          readEffectiveCompilerOptions({
            ...project,
            compilerOptions: { ...project.compilerOptions, module: raw },
          })!("module"),
          padded("commonjs"),
        );
      });
    }
  for (const origin of ["cli", "json"])
    observe(`Unicode JSX ${origin}`, () => {
      const args = origin === "cli" ? ["--jsx", "React-natİve"] : [];
      const selected =
        origin === "json"
          ? {
              ...project,
              compilerOptions: {
                ...project.compilerOptions,
                jsx: "React-natİve",
              },
            }
          : project;
      assert.deepEqual(runtimeCompilerArgs(selected, args), [
        ...args,
        "--jsx",
        "react-jsx",
        "--noEmit",
        "false",
        "--emitDeclarationOnly",
        "false",
      ]);
    });
  observe("invalid leading dash and padded JSON remain data", () => {
    assert.equal(
      readEffectiveCompilerOptions(project, ["--jsx", "-PRESERVE"])!("jsx"),
      "-preserve",
    );
    assert.equal(
      readEffectiveCompilerOptions({
        ...project,
        compilerOptions: { ...project.compilerOptions, jsx: " PRESERVE " },
      })!("jsx"),
      " preserve ",
    );
  });
  for (const code of [0x0, 0x1c, 0x180e, 0x2060, 0xffff]) {
    observe(`outside native whitespace ${code}`, () => {
      const character = String.fromCodePoint(code);
      const value = `${character}PRESERVE${character}`;
      assert.equal(
        readEffectiveCompilerOptions(project, ["--jsx", value])!("jsx"),
        `${character}preserve${character}`,
      );
      assert.equal(
        path.extname(
          resolveSingleFileOutput({
            cwd: root,
            file: view,
            tsconfig: config,
            passthrough: ["--jsx", value],
          }),
        ),
        ".js",
      );
    });
  }
  observe("scalar dash values do not become options", () => {
    const args = Object.freeze(["--rootDir", "--module", "--sourceMap"]);
    const effective = readEffectiveCompilerOptions(project, args)!;
    assert.equal(effective("rootDir"), "--module");
    assert.equal(effective("module"), "commonjs");
    assert.equal(effective("sourceMap"), true);
    assert.equal(
      RuntimeModuleFormat.moduleFormat(
        filename,
        runtimeEmitProfile(project, args, undefined, effective).moduleOptions,
      ),
      "commonjs",
    );
  });
  observe("scalar @data does not resolve a native compiler", () => {
    const effective = readEffectiveCompilerOptions(
      project,
      ["--rootDir", "@data"],
      path.join(root, "absent-native-binary"),
    )!;
    assert.equal(effective("rootDir"), "@data");
    assert.equal(effective("module"), "commonjs");
    assert.deepEqual(
      readCompilerOptionValues(["--rootDir", "@data", "@actual"]).responseFiles,
      ["@actual"],
    );
  });
  for (const [args, expected] of [
    [["--composite", "true"], []],
    [["--composite"], []],
    [["--composite", "false"], [["composite", false]]],
    [["--composite", "null"], [["composite", null]]],
    [["--jsx", "preserve", "--jsx", "null"], [["jsx", null]]],
    [["--jsx", "null", "--jsx", "preserve"], [["jsx", "preserve"]]],
    [["-m", "COMMONJS", "--module", "ESNEXT"], [["module", "esnext"]]],
  ] as const)
    observe(`assignment ${JSON.stringify(args)}`, () => {
      assert.deepEqual(
        [...readCompilerOptionValues(Object.freeze([...args])).values],
        expected,
      );
    });
  fs.writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: { jsx: "preserve" },
      files: ["view.tsx"],
    }),
  );
  for (const [value, expected] of [
    [undefined, ".jsx"],
    ["null", ".js"],
    [" ", ".js"],
    ["\u200b", ".js"],
    ["preserve", ".jsx"],
  ] as const)
    observe(`clear ${JSON.stringify(value)}`, () => {
      assert.equal(
        path.extname(
          resolveSingleFileOutput({
            cwd: root,
            file: view,
            tsconfig: config,
            passthrough: value === undefined ? [] : ["--jsx", value],
          }),
        ),
        expected,
      );
      if (value !== undefined && value !== "preserve") {
        const projected = readCompilerOptionValues(["--jsx", value]);
        assert.equal(projected.values.has("jsx"), true);
        assert.equal(projected.values.get("jsx"), null);
      }
    });
  observe("config and caller tokens stay unchanged", () => {
    assert.equal(JSON.stringify(project.compilerOptions), configured);
    const args = Object.freeze(["--jsx", " PRESERVE "]);
    readEffectiveCompilerOptions(project, args)!("jsx");
    assert.deepEqual(args, ["--jsx", " PRESERVE "]);
  });
  for (const operand of [
    "--build",
    "--generateTrace",
    "--generateCpuProfile",
    "--pprofDir",
    "-p",
    "--tsconfig",
    "@data",
  ]) {
    observe(`consumed scalar inspection ${operand}`, () => {
      const args = Object.freeze(["--rootDir", operand, "--strict"]);
      assert.deepEqual(CompilerArgumentsInspection.inspect(args, root).args, [
        "--rootDir",
        operand,
        "--strict",
        "true",
      ]);
    });
  }
  observe("response scalar and frame boundary", () => {
    fs.writeFileSync(
      path.join(root, "scalar.rsp"),
      "--rootDir --build\n--strict\n",
    );
    const inspected = CompilerArgumentsInspection.inspect(
      ["@scalar.rsp", "--listEmittedFiles", "false"],
      root,
    );
    assert.deepEqual(inspected.args, [
      "--rootDir",
      "--build",
      "--strict",
      "true",
      "--listEmittedFiles",
      "false",
    ]);
    assert.equal(inspected.observations.size, 1);
  });
  for (const tail of ["--rootDir", "--not-a-native-option"]) {
    observe(`unsafe response extension ${tail}`, () => {
      const args = ["@scalar.rsp", tail];
      assert.equal(
        readEffectiveCompilerOptions(
          project,
          args,
          path.join(root, "unavailable-compiler"),
        ),
        null,
      );
      assert.deepEqual(args, ["@scalar.rsp", tail]);
    });
  }
  for (const [args, expected] of [
    [["--listEmittedFiles", "null"], null],
    [["--listEmittedFiles", "true", "--listEmittedFiles", "null"], null],
    [["--listEmittedFiles", "null", "--listEmittedFiles", "false"], false],
  ] as const) {
    observe(`boolean reset presence ${JSON.stringify(args)}`, () => {
      const configuredProject = {
        ...project,
        compilerOptions: { ...project.compilerOptions, listEmittedFiles: true },
      };
      const actual = readEffectiveCompilerOptions(configuredProject, args)!(
        "listEmittedFiles",
      );
      assert.equal(actual, expected);
      assert.equal(
        readCompilerOptionValues(args).values.has("listEmittedFiles"),
        true,
      );
    });
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "effective compiler value observations failed",
    );
}
