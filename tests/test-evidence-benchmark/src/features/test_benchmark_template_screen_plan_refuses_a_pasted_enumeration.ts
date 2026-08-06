import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { benchmarkRoot } from "../internal/suiteRoot";

/**
 * Verifies the screen-plan check counts delivery rather than transcription.
 *
 * The frontend's completeness rule quantified over a set the author chose,
 * which is a rule that cannot be violated, and the script exists to make the
 * frozen corpus the denominator instead. The failure mode it must not have is
 * the mirror image: a rule that cannot fail. Pasting the enumeration into the
 * plan names every section and delivers none, and an identifier is a prefix of
 * every child identifier beneath it, so a containment test would let one
 * screen silently answer for a whole family.
 *
 * 1. Materialize a corpus and run the check with no records at all.
 * 2. Run it against a pasted enumeration, and against reasonless omissions.
 * 3. Run it against a plan naming each identifier beside the page that
 *    delivers it, then remove one row and assert exactly that row is named.
 * 4. Run it against one family omission carrying a reason, and assert it
 *    covers the children beneath it.
 */
export const test_benchmark_template_screen_plan_refuses_a_pasted_enumeration =
  (): void => {
    const root: string = fs.mkdtempSync(
      path.join(os.tmpdir(), "evidence-screen-plan-"),
    );
    try {
      const frontend: string = path.join(root, "packages", "frontend");
      const wiki: string = path.join(frontend, "wiki");
      fs.mkdirSync(path.join(frontend, "scripts"), { recursive: true });
      fs.mkdirSync(wiki, { recursive: true });
      fs.mkdirSync(path.join(root, "docs", "analysis"), { recursive: true });
      fs.copyFileSync(
        path.join(
          benchmarkRoot,
          "template",
          "base",
          "packages",
          "frontend",
          "scripts",
          "screen-plan.mjs",
        ),
        path.join(frontend, "scripts", "screen-plan.mjs"),
      );
      fs.writeFileSync(
        path.join(root, "docs", "analysis", "01-requirements.md"),
        [
          "# Requirements",
          "",
          "## REQ-TODO Todo Operations",
          "",
          "### REQ-TODO-1 Create a Todo",
          "",
          "### REQ-TODO-2 Browse Todos",
          "",
          "## REQ-RETENTION Retention Rules",
          "",
          "### REQ-RETENTION-1 Keep Edit History",
          "",
        ].join("\n"),
      );

      const record = (name: string, content: string): void => {
        for (const file of ["screen-plan.md", "omissions.md"])
          fs.rmSync(path.join(wiki, file), { force: true });
        if (content !== "") fs.writeFileSync(path.join(wiki, name), content);
      };
      const check = (): { covered: string; code: number; detail: string } => {
        const result = spawnSync(
          process.execPath,
          [path.join(frontend, "scripts", "screen-plan.mjs")],
          { cwd: frontend, encoding: "utf8" },
        );
        return {
          covered: (result.stdout ?? "").split("/")[0]!.trim(),
          code: result.status ?? -1,
          detail: result.stderr ?? "",
        };
      };
      const expect = (
        label: string,
        covered: string,
        code: number,
      ): { detail: string } => {
        const actual = check();
        if (actual.covered !== covered || actual.code !== code)
          throw new Error(
            `${label}: expected ${covered}/5 and exit ${code}, got ${actual.covered}/5 and exit ${actual.code}.`,
          );
        return { detail: actual.detail };
      };

      // Step 1: nothing recorded settles nothing.
      record("screen-plan.md", "");
      expect("an empty workspace", "0", 1);

      // Step 2: transcription is not delivery, in either record.
      record(
        "screen-plan.md",
        [
          "REQ-TODO Todo Operations",
          "REQ-TODO-1 Create a Todo",
          "REQ-TODO-2 Browse Todos",
          "REQ-RETENTION Retention Rules",
          "REQ-RETENTION-1 Keep Edit History",
          "",
        ].join("\n"),
      );
      expect("a pasted enumeration", "0", 1);
      record(
        "omissions.md",
        ["REQ-TODO", "REQ-TODO-1", "REQ-RETENTION", ""].join("\n"),
      );
      expect("omissions with no reason", "0", 1);

      // Step 3: a plan that names the page delivering each identifier.
      const rows: string[] = [
        "| REQ-TODO | todo-page.tsx |",
        "| REQ-TODO-1 | todo-page.tsx |",
        "| REQ-TODO-2 | todo-page.tsx |",
        "| REQ-RETENTION | history-page.tsx |",
        "| REQ-RETENTION-1 | history-page.tsx |",
      ];
      record("screen-plan.md", `${rows.join("\n")}\n`);
      expect("a plan naming every page", "5", 0);

      record("screen-plan.md", `${rows.slice(1).join("\n")}\n`);
      const partial = expect("a plan missing one family head", "4", 1);
      if (partial.detail.includes("REQ-TODO Todo Operations") === false)
        throw new Error(
          `The missing section was not named: ${partial.detail}`,
        );
      if (partial.detail.includes("REQ-TODO-1") === true)
        throw new Error(
          "A delivered child was reported missing, so identifiers are not compared as whole tokens.",
        );

      // Step 4: one family decision covers the sections beneath it.
      record(
        "omissions.md",
        [
          "- REQ-TODO: the backend enforces this rule and no screen renders it;",
          "  false the moment a requirement asks a user to see it.",
          "- REQ-RETENTION: same owner, same invalidating condition, written out",
          "  at length so the line carries a reason rather than an identifier.",
          "",
        ].join("\n"),
      );
      expect("family omissions carrying reasons", "5", 0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
