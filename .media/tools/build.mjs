/**
 * Composes the render specs.
 *
 * A clip shows one of two things, and never invents either. A rule that
 * publishes a completion corpus shows that corpus, rebuilt from the same maps
 * the rule publishes from. Every other rule shows its diagnostic, whose text is
 * the message captured from a real `ttsc check` run when one is available and
 * the rule's checked catalog summary otherwise — recorded per clip so the two
 * are never confused.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { corpus } from "./jsdoc.mjs";
import { selection } from "./selection.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(HERE, "messages.json");

/**
 * The one built-in rule that publishes completion, and the caret that reaches
 * it.
 */
const COMPLETION_RULE = "jsdoc/check-tag-names";
const COMPLETION_CODE = `/**
 * Returns the visible title for one catalog entry.
 * @
 */
export function title(entry: Entry): string {
  return entry.title;
}`;

export function specs() {
  const captured = fs.existsSync(MESSAGES)
    ? JSON.parse(fs.readFileSync(MESSAGES, "utf8"))
    : {};
  const { clips, missing } = selection();
  if (missing.length) {
    throw new Error(`unresolved clip selection: ${missing.join(", ")}`);
  }
  const tags = corpus();
  return clips.map((clip) => {
    if (clip.rule === COMPLETION_RULE) {
      return {
        ...clip,
        bad: " * @",
        code: COMPLETION_CODE,
        completion: tags.slice(0, 6),
        completionTotal: tags.length,
        file: "src/catalog.ts",
      };
    }
    return {
      ...clip,
      // Only a rule the catalog documents as autofixable can show the
      // lightbulb. Most rules cannot: a finding about a missing await or an
      // inaccessible control is a judgement, not a mechanical rewrite, which is
      // why the fixable rules cluster in the syntax-shaped families.
      fix: clip.autofixable ? "source.fixAll.ttsc" : undefined,
      message: captured[clip.rule] ?? clip.description,
      messageSource: captured[clip.rule] ? "ttsc check" : "rule catalog",
    };
  });
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))
) {
  const all = specs();
  const captured = all.filter((clip) => clip.messageSource === "ttsc check");
  process.stdout.write(
    `${all.length} clips, ${captured.length} with captured messages\n`,
  );
}
