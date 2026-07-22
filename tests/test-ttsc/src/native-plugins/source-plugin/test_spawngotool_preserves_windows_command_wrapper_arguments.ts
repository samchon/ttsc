import { TestProject } from "@ttsc/testing";

import {
  computeCacheKey,
  spawnGoTool,
  windowsGoCommandArgs,
} from "../../../../../packages/ttsc/lib/plugin/internal/buildSourcePlugin.js";
import { assert, fs, path } from "../../internal/source-build";

/**
 * Verifies source plugins: Windows command wrappers receive literal argv.
 *
 * `cmd.exe` expands percent references and, when enabled, delayed exclamation
 * references even inside quoted command text. The source-plugin launcher must
 * disable delayed expansion and pass every volatile value through one-pass
 * environment indirection without mutating the caller's environment.
 *
 * 1. Assert the production cmd argument plan explicitly contains `/v:off`.
 * 2. Put fake wrappers under hostile, whitespace, and quoted-semicolon paths.
 * 3. Run absolute, PATH-resolved, and relative wrappers with hostile argv.
 * 4. Assert native precedence, search-policy fidelity, and missing ENOENT.
 */
export const test_spawngotool_preserves_windows_command_wrapper_arguments =
  () => {
    assert.deepEqual(windowsGoCommandArgs("payload"), [
      "/d",
      "/v:off",
      "/s",
      "/c",
      "payload",
    ]);
    if (process.platform !== "win32") return;

    const root = TestProject.tmpdir("ttsc-go-command-shim-");
    const wrapperRoot = path.join(
      root,
      "%TTSC_GO_EXPANDS% literal %% & (parentheses) ^ caret !TTSC_GO_DELAYED!",
    );
    fs.mkdirSync(wrapperRoot, { recursive: true });
    const capture = path.join(root, "argv.jsonl");
    const script = path.join(wrapperRoot, "capture.cjs");
    fs.writeFileSync(
      script,
      [
        'const fs = require("node:fs");',
        "fs.appendFileSync(",
        "  process.env.TTSC_GO_ARGV_CAPTURE,",
        "  JSON.stringify({",
        "    args: process.argv.slice(2),",
        "    sentinel: process.env.TTSC_GO_CALLER_SENTINEL,",
        '  }) + "\\n",',
        '  "utf8",',
        ");",
        "",
      ].join("\n"),
      "utf8",
    );
    const wrapper = path.join(wrapperRoot, "go.cmd");
    fs.writeFileSync(
      wrapper,
      `@echo off\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
      "utf8",
    );

    const commands = [
      ["version"],
      [
        "env",
        "-json",
        "GOOS",
        "%SET_VALUE%",
        "%%",
        "%",
        "%UNKNOWN%",
        "!SET_VALUE!",
        "!",
        "!UNKNOWN!",
      ],
      ["mod", "edit", "-json", "space value", "&", "(value)", "^"],
      ["build", "-o", path.join(wrapperRoot, '%OUTPUT% & "quoted" \\'), "."],
    ];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TTSC_GO_ARGV_CAPTURE: capture,
      TTSC_GO_CALLER_SENTINEL: "preserved",
      TTSC_GO_DELAYED: "WRONG_DIRECTORY",
      TTSC_GO_EXPANDS: "WRONG_DIRECTORY",
      TTSC_GO_TEST_NODE: process.execPath,
      SET_VALUE: "WRONG_ARGUMENT",
    };
    for (const args of commands) {
      const result = spawnGoTool(wrapper, args, {
        encoding: "utf8",
        env,
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr || result.error?.message);
    }

    const lookupArgs = ["env", "PATH lookup", "%LOOKUP%", "!LOOKUP!"];
    const lookupResult = spawnGoTool("go", lookupArgs, {
      cwd: root,
      encoding: "utf8",
      env: { ...env, PATH: wrapperRoot, PATHEXT: ".EXE;.CMD" },
      windowsHide: true,
    });
    assert.equal(
      lookupResult.status,
      0,
      lookupResult.stderr || lookupResult.error?.message,
    );

    const relativeArgs = ["version", "relative wrapper"];
    const relativeResult = spawnGoTool(".\\go.cmd", relativeArgs, {
      cwd: wrapperRoot,
      encoding: "utf8",
      env,
      windowsHide: true,
    });
    assert.equal(
      relativeResult.status,
      0,
      relativeResult.stderr || relativeResult.error?.message,
    );

    const whitespaceRoot = path.join(root, " leading-path-entry");
    fs.mkdirSync(whitespaceRoot, { recursive: true });
    fs.copyFileSync(script, path.join(whitespaceRoot, "capture.cjs"));
    fs.copyFileSync(wrapper, path.join(whitespaceRoot, "go.cmd"));
    const whitespaceArgs = ["version", "literal PATH whitespace"];
    const whitespaceResult = spawnGoTool("go", whitespaceArgs, {
      cwd: root,
      encoding: "utf8",
      env: { ...env, PATH: whitespaceRoot, PATHEXT: ".CMD" },
      windowsHide: true,
    });
    assert.equal(
      whitespaceResult.status,
      0,
      whitespaceResult.stderr || whitespaceResult.error?.message,
    );

    const semicolonRoot = path.join(root, "quoted;path-entry");
    fs.mkdirSync(semicolonRoot, { recursive: true });
    fs.copyFileSync(script, path.join(semicolonRoot, "capture.cjs"));
    fs.copyFileSync(wrapper, path.join(semicolonRoot, "go.cmd"));
    const semicolonArgs = ["version", "quoted semicolon PATH"];
    const semicolonResult = spawnGoTool("go", semicolonArgs, {
      cwd: root,
      encoding: "utf8",
      env: { ...env, PATH: `"${semicolonRoot}"`, PATHEXT: ".CMD" },
      windowsHide: true,
    });
    assert.equal(
      semicolonResult.status,
      0,
      semicolonResult.stderr || semicolonResult.error?.message,
    );

    fs.copyFileSync(wrapper, path.join(wrapperRoot, "node.cmd"));
    const nativeMarker = path.join(root, "native-selected.txt");
    const nativeResult = spawnGoTool(
      "node",
      [
        "-e",
        'require("node:fs").writeFileSync(process.env.TTSC_GO_NATIVE_MARKER, "native")',
      ],
      {
        cwd: wrapperRoot,
        encoding: "utf8",
        env: {
          ...env,
          PATH: path.dirname(process.execPath),
          PATHEXT: ".CMD;.EXE",
          TTSC_GO_NATIVE_MARKER: nativeMarker,
        },
        windowsHide: true,
      },
    );
    assert.equal(
      nativeResult.status,
      0,
      nativeResult.stderr || nativeResult.error?.message,
    );
    assert.equal(fs.readFileSync(nativeMarker, "utf8"), "native");

    const blockedRoot = path.join(root, "blocked-current-directory");
    fs.mkdirSync(blockedRoot, { recursive: true });
    fs.writeFileSync(path.join(blockedRoot, "go.cmd"), "@exit /b 91\r\n");
    const noCwdArgs = ["version", "skip current directory"];
    const noDefaultCurrentDirectory =
      process.env.NoDefaultCurrentDirectoryInExePath;
    try {
      process.env.NoDefaultCurrentDirectoryInExePath = "1";
      const noCwdResult = spawnGoTool("go", noCwdArgs, {
        cwd: blockedRoot,
        encoding: "utf8",
        env: {
          ...env,
          PATH: `"${semicolonRoot}"`,
          PATHEXT: ".CMD",
        },
        windowsHide: true,
      });
      assert.equal(
        noCwdResult.status,
        0,
        noCwdResult.stderr || noCwdResult.error?.message,
      );
    } finally {
      if (noDefaultCurrentDirectory === undefined) {
        delete process.env.NoDefaultCurrentDirectoryInExePath;
      } else {
        process.env.NoDefaultCurrentDirectoryInExePath =
          noDefaultCurrentDirectory;
      }
    }

    const envWithoutPath: NodeJS.ProcessEnv = { ...env, PATHEXT: ".CMD" };
    for (const key of Object.keys(envWithoutPath)) {
      if (key.toLowerCase() === "path") delete envWithoutPath[key];
    }
    const parentPath = process.env.PATH;
    const inheritedPathArgs = ["version", "inherited PATH"];
    try {
      process.env.PATH = whitespaceRoot;
      const inheritedPathResult = spawnGoTool("go", inheritedPathArgs, {
        cwd: root,
        encoding: "utf8",
        env: envWithoutPath,
        windowsHide: true,
      });
      assert.equal(
        inheritedPathResult.status,
        0,
        inheritedPathResult.stderr || inheritedPathResult.error?.message,
      );
    } finally {
      if (parentPath === undefined) delete process.env.PATH;
      else process.env.PATH = parentPath;
    }

    const duplicatePathArgs = ["version", "duplicate PATH casing"];
    const duplicatePathResult = spawnGoTool("go", duplicatePathArgs, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...envWithoutPath,
        Path: `"${semicolonRoot}"`,
        path: blockedRoot,
      },
      windowsHide: true,
    });
    assert.equal(
      duplicatePathResult.status,
      0,
      duplicatePathResult.stderr || duplicatePathResult.error?.message,
    );

    const plugin = path.join(root, "plugin");
    const relativeToolchainA = path.join(plugin, "relative-toolchain-a");
    const relativeToolchainB = path.join(plugin, "relative-toolchain-b");
    fs.mkdirSync(relativeToolchainA, { recursive: true });
    fs.mkdirSync(relativeToolchainB, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    for (const toolchain of [relativeToolchainA, relativeToolchainB]) {
      fs.copyFileSync(script, path.join(toolchain, "capture.cjs"));
    }
    fs.writeFileSync(
      path.join(relativeToolchainA, "go.cmd"),
      `@echo off\r\nrem compiler a\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(relativeToolchainB, "go.cmd"),
      `@echo off\r\nrem compiler b\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
      "utf8",
    );
    const keyA = computeCacheKey({
      dir: plugin,
      entry: ".",
      env: {
        ...env,
        PATH: "relative-toolchain-a",
        PATHEXT: ".CMD",
      },
      goBinary: "go",
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    const keyB = computeCacheKey({
      dir: plugin,
      entry: ".",
      env: {
        ...env,
        PATH: "relative-toolchain-b",
        PATHEXT: ".CMD",
      },
      goBinary: "go",
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    assert.notEqual(keyA, keyB);

    for (const missing of [
      "missing-go",
      "missing-go.cmd",
      ".\\missing-go.cmd",
    ]) {
      const result = spawnGoTool(missing, ["version"], {
        cwd: root,
        encoding: "utf8",
        env: { ...env, PATH: root, PATHEXT: ".CMD" },
        windowsHide: true,
      });
      assert.equal(
        (result.error as NodeJS.ErrnoException | undefined)?.code,
        "ENOENT",
      );
    }

    const captured = fs
      .readFileSync(capture, "utf8")
      .trim()
      .split(/\r?\n/)
      .map(
        (line) =>
          JSON.parse(line) as { args: string[]; sentinel: string | undefined },
      );
    const expectedArgs = [
      ...commands,
      lookupArgs,
      relativeArgs,
      whitespaceArgs,
      semicolonArgs,
      noCwdArgs,
      inheritedPathArgs,
      duplicatePathArgs,
    ];
    assert.deepEqual(
      captured.slice(0, expectedArgs.length).map(({ args }) => args),
      expectedArgs,
    );
    assert.equal(captured.length, expectedArgs.length + 4);
    for (let index = expectedArgs.length; index < captured.length; index += 2) {
      assert.deepEqual(captured[index]?.args, ["version"]);
      assert.deepEqual(captured[index + 1]?.args.slice(0, 2), ["env", "-json"]);
    }
    assert.ok(captured.every(({ sentinel }) => sentinel === "preserved"));
    assert.equal(
      Object.keys(env).some((key) => key.startsWith("TTSC_GO_COMMAND_SHIM_")),
      false,
      "the caller's environment object must not be mutated",
    );
  };
