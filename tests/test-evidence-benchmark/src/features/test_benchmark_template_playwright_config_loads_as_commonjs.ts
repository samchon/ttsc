import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { benchmarkRoot } from "../internal/suiteRoot";

/**
 * Verifies the delivered Playwright config evaluates where Playwright runs it.
 *
 * Playwright loads its config through a TypeScript require hook, and the
 * frontend package declares no `"type": "module"`, so the file evaluates as
 * CommonJS. The template shipped it resolving `.env` through
 * `import.meta.dirname`, which does not exist there. That is not a wrong path
 * that surfaces as a failing test — it throws while the config is being read,
 * before a single test is discovered, so the end-to-end gate reports nothing
 * rather than reporting that it could not start.
 *
 * The first cohort paid for this three separate ways, and none of them measured
 * the cell. One cell repaired the line itself and passed its gates. One refused
 * to touch frozen configuration, built a substitute runner instead, and failed
 * its overall review for using it. One received an operator's explicit
 * permission to make the same repair, which no other cell was offered. What a
 * cell scored turned on how it reacted to a defect it did not write.
 *
 * The case evaluates the delivered file the way its loader does rather than
 * reading it for a forbidden spelling: a rule against the words `import.meta`
 * would pass the day someone reaches the same undefined value another way, and
 * would fail `vite.config.ts`, which uses that form correctly because Vite
 * hands its config an ESM-capable loader.
 *
 * It also pins the module system the repair depends on. `__dirname` is right
 * only while the package stays CommonJS, so a later `"type": "module"` must
 * arrive as a failure here rather than as a silent return to a dead gate.
 */
export const test_benchmark_template_playwright_config_loads_as_commonjs =
  (): void => {
    const frontend: string = path.join(
      benchmarkRoot,
      "template",
      "base",
      "packages",
      "frontend",
    );
    const manifest: Record<string, unknown> = JSON.parse(
      fs.readFileSync(path.join(frontend, "package.json"), "utf8"),
    );
    if (manifest.type !== undefined)
      throw new Error(
        `The frontend package now declares "type": ${JSON.stringify(manifest.type)}. playwright.config.ts resolves its environment file with \`__dirname\`, which exists only while the package loads as CommonJS. Decide what the config should use before changing this.`,
      );

    const root: string = fs.mkdtempSync(
      path.join(os.tmpdir(), "evidence-playwright-config-"),
    );
    try {
      // Evaluated as CommonJS, with the two imports the config takes from
      // outside stubbed. The stubs matter as little as possible: the point is
      // which module system the file is read under, not what Playwright would
      // do with the object afterwards.
      const source: string = fs.readFileSync(
        path.join(frontend, "playwright.config.ts"),
        "utf8",
      );
      const compiled: string = source
        .replace(
          /^import \{ defineConfig, devices \} from "@playwright\/test";$/mu,
          "const { defineConfig, devices } = require('./playwright-stub.cjs');",
        )
        .replace(/^import (\w+) from "node:(\w+)";$/gmu, "const $1 = require('node:$2');")
        .replace(/^export default /mu, "module.exports = ")
        .replace(/(\w+)\s+as\s+\w+/gu, "$1")
        .replace(/:\s*(?:string|number|boolean)\b/gu, "");
      fs.writeFileSync(
        path.join(root, "playwright-stub.cjs"),
        "module.exports = { defineConfig: (value) => value, devices: new Proxy({}, { get: () => ({}) }) };\n",
        "utf8",
      );
      fs.writeFileSync(path.join(root, "config.cjs"), compiled, "utf8");
      fs.writeFileSync(
        path.join(root, "run.cjs"),
        [
          "const config = require('./config.cjs');",
          "if (typeof config !== 'object' || config === null)",
          "  throw new Error('The config did not evaluate to an object.');",
          "if (typeof config.testDir !== 'string')",
          "  throw new Error('The evaluated config carries no testDir.');",
          "console.log('ok');",
          "",
        ].join("\n"),
        "utf8",
      );

      const result = spawnSync(process.execPath, [path.join(root, "run.cjs")], {
        encoding: "utf8",
      });
      if (result.status !== 0)
        throw new Error(
          [
            "The delivered playwright.config.ts does not evaluate as CommonJS, which is how Playwright reads it.",
            "Every end-to-end gate in every workspace built from this template starts by loading this file.",
            "",
            (result.stderr || result.stdout || "").trim(),
          ].join("\n"),
        );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
