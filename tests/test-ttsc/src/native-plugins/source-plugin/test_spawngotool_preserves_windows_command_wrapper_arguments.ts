import { TestProject } from "@ttsc/testing";

import { spawnGoTool } from "../../../../../packages/ttsc/lib/plugin/internal/buildSourcePlugin.js";
import { assert, fs, path } from "../../internal/source-build";

/** Windows command wrappers receive literal paths and argv through cmd.exe. */
export const test_spawngotool_preserves_windows_command_wrapper_arguments =
  () => {
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

    const captured = fs
      .readFileSync(capture, "utf8")
      .trim()
      .split(/\r?\n/)
      .map(
        (line) =>
          JSON.parse(line) as { args: string[]; sentinel: string | undefined },
      );
    assert.deepEqual(
      captured.map(({ args }) => args),
      commands,
    );
    assert.ok(captured.every(({ sentinel }) => sentinel === "preserved"));
    assert.equal(
      Object.keys(env).some((key) => key.startsWith("TTSC_GO_COMMAND_SHIM_")),
      false,
      "the caller's environment object must not be mutated",
    );
  };
