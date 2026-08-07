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
 * the mirror image, a rule that cannot fail, and two earlier shapes of this
 * script had it: one accepted the enumeration pasted verbatim, and the next
 * accepted a single line listing every identifier, or the enumeration with a
 * page name appended to each row. Each case below is one of those.
 *
 * 1. Run with no records, then with each transcription a copy produces.
 * 2. Run with a plan naming a page file nobody wrote, and one naming the
 *    development gallery the screen population excludes.
 * 3. Run with an honest plan, by identifier and by the graph's own anchor, and
 *    with a family omission whose reason wraps across lines.
 * 4. Remove one row and assert exactly that section is named while its children
 *    stay covered.
 */
export const test_benchmark_template_screen_plan_refuses_a_pasted_enumeration =
  (): void => {
    const root: string = fs.mkdtempSync(
      path.join(os.tmpdir(), "evidence-screen-plan-"),
    );
    try {
      const frontend: string = path.join(root, "packages", "frontend");
      const wiki: string = path.join(frontend, "wiki");
      const domain: string = path.join(frontend, "src", "components", "todo");
      const gallery: string = path.join(frontend, "src", "components", "dev");
      for (const directory of [
        path.join(frontend, "scripts"),
        wiki,
        domain,
        gallery,
        path.join(root, "docs", "analysis"),
      ])
        fs.mkdirSync(directory, { recursive: true });
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
      fs.writeFileSync(path.join(domain, "todo-page.tsx"), "");
      fs.writeFileSync(path.join(gallery, "gallery-page.tsx"), "");
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

      const identifiers: string[] = [
        "REQ-TODO",
        "REQ-TODO-1",
        "REQ-TODO-2",
        "REQ-RETENTION",
        "REQ-RETENTION-1",
      ];

      // Step 1: nothing recorded, then every shape a copy takes.
      record("screen-plan.md", "");
      expect("an empty workspace", "0", 1);
      record("screen-plan.md", `${identifiers.join("\n")}\n`);
      expect("the enumeration pasted", "0", 1);
      record("omissions.md", `${identifiers.join(" ")}\n`);
      expect("every identifier on one line", "0", 1);
      record(
        "screen-plan.md",
        `${identifiers.map((id) => `| ${id} | todo-page.tsx |`).join(" ")}\n`,
      );
      expect("every row collapsed onto one line", "0", 1);
      record(
        "omissions.md",
        `${identifiers.map((id) => `- ${id}`).join("\n")}\n`,
      );
      expect("identifiers with no reason", "0", 1);

      // Step 2: a page nobody wrote, and one the screen population excludes.
      const rows = (page: string): string =>
        `${identifiers.map((id) => `| ${id} | ${page} |`).join("\n")}\n`;
      record("screen-plan.md", rows("nowhere-page.tsx"));
      expect("a page file that does not exist", "0", 1);
      record("screen-plan.md", rows("gallery-page.tsx"));
      expect("the development gallery", "0", 1);

      // Step 3: the forms an author actually writes.
      record("screen-plan.md", rows("todo-page.tsx"));
      expect("a plan naming a page that exists", "5", 0);
      record(
        "screen-plan.md",
        [
          "| docs/analysis/01-requirements.md#req-todo-todo-operations | todo-page.tsx |",
          "| docs/analysis/01-requirements.md#req-todo-1-create-a-todo | todo-page.tsx |",
          "| docs/analysis/01-requirements.md#req-todo-2-browse-todos | todo-page.tsx |",
          "| docs/analysis/01-requirements.md#req-retention-retention-rules | todo-page.tsx |",
          "| docs/analysis/01-requirements.md#req-retention-1-keep-edit-history | todo-page.tsx |",
          "",
        ].join("\n"),
      );
      expect("a plan citing the graph's own anchors", "5", 0);
      record(
        "omissions.md",
        [
          "- REQ-TODO",
          "  The backend enforces this rule and no browser surface renders it;",
          "  false the moment a requirement asks a user to see it.",
          "- REQ-RETENTION",
          "  Same owner, same invalidating condition, wrapped the same way.",
          "",
        ].join("\n"),
      );
      expect("family omissions whose reasons wrap", "5", 0);

      // Step 4: one row removed names itself and nothing else.
      record(
        "screen-plan.md",
        `${identifiers
          .slice(1)
          .map((id) => `| ${id} | todo-page.tsx |`)
          .join("\n")}\n`,
      );
      const partial = expect("a plan missing one family head", "4", 1);
      if (partial.detail.includes("REQ-TODO Todo Operations") === false)
        throw new Error(`The missing section was not named: ${partial.detail}`);
      if (partial.detail.includes("REQ-TODO-1") === true)
        throw new Error(
          "A delivered child was reported missing, so identifiers are not compared as whole tokens.",
        );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
