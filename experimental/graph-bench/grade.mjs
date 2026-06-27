#!/usr/bin/env node
// Deterministic quality grader for the graph benchmark.
//
// It scores a captured agent answer against a prompt's gold file — required
// symbols (containment), required edges (ordered containment), phrases that must
// appear, and claims that must not — so a token saving never counts as a win
// while the answer is wrong. It is pure text containment: no model judges the
// answer, so the same answer always grades the same.
//
// Usage:
//   node grade.mjs --report=<report.json> [--manifest=<manifest.json>]
//                  [--threshold=0.8] [--out=<graded.json>]
//
// The report is any JSON holding an array of samples (found under `samples`,
// `cells`, or the top-level array); each sample needs a `promptId` and the
// captured answer text under `answer` (or `answerText`). Grades are printed and,
// with --out, written back onto each sample as `quality`.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** SHA-256 of a question file's bytes, the manifest's integrity stamp. */
export function questionSha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// Match on alphanumerics only, so phrasing never decides correctness: an answer
// that writes `QueryBuilder`, `query builder`, or `query-builder` all satisfy the
// same gold term, and `leftJoin` satisfies `left join`. This is the universal
// fix for golds failing on camelCase-vs-spaced wording rather than on substance.
const loose = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Coerce a gold field to an array so one hand-authored gold that wrote a bare
 * string where a list belongs cannot crash an entire (expensive) benchmark run
 * at grading time. A string becomes a one-element list; nullish becomes empty.
 */
function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

/** First index of needle in the loose-normalized haystack, or -1. */
function indexOfPhrase(haystack, needle) {
  const n = loose(needle);
  return n ? haystack.indexOf(n) : -1;
}

/**
 * First index where a required mention is evidenced. Unlike prohibited claims,
 * required mentions should not fail solely because the answer says "join
 * aliases" or "aliases for joins" instead of the exact phrase "join alias".
 */
function mentionIndex(answer, hay, phrase) {
  const exact = indexOfPhrase(hay, phrase);
  if (exact >= 0) return exact;
  const wanted = wordsOf(phrase);
  if (wanted.length <= 1) return -1;
  const words = wordsWithPositions(answer);
  for (let i = 0; i < words.length; i++) {
    if (!wordMatches(words[i].word, wanted[0])) continue;
    let cursor = i + 1;
    let matched = 1;
    while (cursor < words.length && cursor - i <= 80) {
      if (wordMatches(words[cursor].word, wanted[matched])) {
        matched++;
        if (matched === wanted.length) return words[i].index;
      }
      cursor++;
    }
  }
  for (let i = 0; i < words.length; i++) {
    const window = words.slice(i, i + 81).map((item) => item.word);
    if (
      wanted.every((needle) =>
        window.some((actual) => wordMatches(actual, needle)),
      )
    ) {
      return words[i].index;
    }
  }
  return -1;
}

function wordsOf(text) {
  return (text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function wordsWithPositions(text) {
  const out = [];
  for (const match of (text ?? "").toLowerCase().matchAll(/[a-z0-9]+/g)) {
    out.push({ word: match[0], index: match.index ?? 0 });
  }
  return out;
}

function wordMatches(actual, expected) {
  return (
    actual === expected ||
    actual === `${expected}s` ||
    expected === `${actual}s`
  );
}

/** Every index of needle in the loose-normalized haystack. */
function indexesOfPhrase(haystack, needle) {
  const n = loose(needle);
  if (!n) return [];
  const out = [];
  let start = 0;
  while (start < haystack.length) {
    const index = haystack.indexOf(n, start);
    if (index < 0) break;
    out.push(index);
    start = index + Math.max(1, n.length);
  }
  return out;
}

/**
 * Earliest index at which a (possibly dotted) symbol is evidenced in the answer,
 * or -1. A dotted `Owner.member` matches either the full dotted form or the bare
 * `member` when `Owner` also appears, so an answer that writes `applyFindOptions`
 * and names `SelectQueryBuilder` elsewhere still counts.
 */
function symbolIndex(hay, symbol) {
  const indexes = symbolIndexes(hay, symbol);
  return indexes.length === 0 ? -1 : Math.min(...indexes);
}

/** Every position where a symbol is evidenced in the answer. */
function symbolIndexes(hay, symbol) {
  const full = indexesOfPhrase(hay, symbol);
  if (full.length > 0) return full;
  const dot = symbol.lastIndexOf(".");
  if (dot < 0) return [];
  const owner = symbol.slice(0, dot);
  const member = symbol.slice(dot + 1);
  const ownerAt = indexOfPhrase(hay, owner);
  const memberAt = indexesOfPhrase(hay, member);
  return ownerAt >= 0 ? memberAt : [];
}

/**
 * Grade one answer against a gold object. Returns the per-axis scores and a
 * boolean `pass`: enough required symbols present, every required edge in order,
 * every must-mention phrase present, and no must-not claim made.
 */
export function gradeAnswer(answer, gold, threshold = 0.8) {
  const hay = loose(answer ?? "");

  const requiredSymbols = asArray(gold.requiredSymbols);
  const matchedSymbols = requiredSymbols.filter((s) => symbolIndex(hay, s) >= 0);
  const symbolCoverage =
    requiredSymbols.length === 0 ? 1 : matchedSymbols.length / requiredSymbols.length;

  const requiredEdges = asArray(gold.requiredEdges);
  const orderedEdges = requiredEdges.filter(([from, to]) => {
    const fromIndexes = symbolIndexes(hay, from);
    const toIndexes = symbolIndexes(hay, to);
    return fromIndexes.some((a) => toIndexes.some((b) => a < b));
  });
  const edgeOrder =
    requiredEdges.length === 0 ? 1 : orderedEdges.length / requiredEdges.length;

  const mustMention = asArray(gold.mustMention);
  const mentionsMissing = mustMention.filter(
    (m) => mentionIndex(answer ?? "", hay, m) < 0,
  );

  const mustNotClaim = asArray(gold.mustNotClaim);
  const violatedMustNot = mustNotClaim.filter((m) => indexOfPhrase(hay, m) >= 0);

  const pass =
    symbolCoverage >= threshold &&
    edgeOrder >= threshold &&
    mentionsMissing.length === 0 &&
    violatedMustNot.length === 0;

  return {
    symbolCoverage: round(symbolCoverage),
    matchedSymbols,
    missingSymbols: requiredSymbols.filter((s) => !matchedSymbols.includes(s)),
    edgeOrder: round(edgeOrder),
    mentionsMissing,
    violatedMustNot,
    pass,
  };
}

const round = (n) => Math.round(n * 100) / 100;

/** Load the manifest and index its prompts by id, resolving each gold file. */
function loadGold(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const byId = new Map();
  for (const prompt of manifest.prompts ?? []) {
    const questionFile = path.resolve(here, "questions", prompt.file);
    const goldFile = path.resolve(here, "questions", prompt.gold);
    const gold = JSON.parse(fs.readFileSync(goldFile, "utf8"));
    const expected = prompt.questionSha256;
    const actual = questionSha256(questionFile);
    if (expected && expected !== actual) {
      console.warn(
        `warning: ${prompt.id} question sha mismatch (manifest ${expected.slice(0, 12)} != file ${actual.slice(0, 12)})`,
      );
    }
    byId.set(prompt.id, { prompt, gold });
  }
  return byId;
}

/** Pull the sample array out of whatever shape the report uses. */
function samplesOf(report) {
  if (Array.isArray(report)) return report;
  const found = report.samples ?? report.cells;
  if (Array.isArray(found)) return found;
  // The A/B harness keys samples by arm ({ baseline: [...], graph: [...] });
  // flatten so the CLI grades the arm-keyed report directly.
  if (found && typeof found === "object") {
    return Object.values(found)
      .flat()
      .filter((sample) => sample && typeof sample === "object");
  }
  return [];
}

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function main() {
  const reportPath = arg("report");
  if (!reportPath) {
    console.error("grade.mjs: --report=<path> is required");
    process.exit(2);
  }
  const manifestPath = path.resolve(
    arg("manifest", path.join(here, "questions", "manifest.json")),
  );
  const threshold = Number(arg("threshold", "0.8"));
  const outPath = arg("out");

  const gold = loadGold(manifestPath);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const samples = samplesOf(report);

  let graded = 0;
  let passed = 0;
  for (const sample of samples) {
    const id = sample.promptId ?? sample.prompt;
    const entry = id && gold.get(id);
    if (!entry) continue;
    const answer = sample.answer ?? sample.answerText ?? "";
    const quality = gradeAnswer(answer, entry.gold, threshold);
    sample.quality = quality;
    graded++;
    if (quality.pass) passed++;
    const flags = [
      `sym ${quality.symbolCoverage}`,
      `edges ${quality.edgeOrder}`,
      quality.mentionsMissing.length ? `missing[${quality.mentionsMissing.join(",")}]` : "",
      quality.violatedMustNot.length ? `VIOLATION[${quality.violatedMustNot.join(",")}]` : "",
    ]
      .filter(Boolean)
      .join("  ");
    console.log(`${quality.pass ? "PASS" : "FAIL"}  ${id}  ${flags}`);
  }

  console.log(`\n${passed}/${graded} passed (threshold ${threshold})`);
  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`graded report: ${outPath}`);
  }
  if (graded === 0) {
    console.error("grade.mjs: no samples matched a manifest promptId");
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
