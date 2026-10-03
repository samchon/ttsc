import fs from "node:fs";
import path from "node:path";

const loaded: unknown = JSON.parse(
  fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../../../../fixtures/evidence/consumer-corpus.json",
    ),
    "utf8",
  ),
);
if (loaded === null || typeof loaded !== "object" || Array.isArray(loaded))
  throw new Error("The authored Evidence consumer corpus must be a text map.");
const corpus: Array<readonly [string, string]> = [];
for (const [name, text] of Object.entries(loaded)) {
  if (
    typeof text !== "string" ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.split("/").some((part) => part === "." || part === ".." || part === "")
  )
    throw new Error("Invalid authored Evidence consumer input: " + name);
  corpus.push([name, text]);
}

/** Owns the fixed source population shared by the real Evidence consumer. */
export namespace EvidenceConsumerCorpus {
  /**
   * Return authored configuration and source text for one named population.
   *
   * These populations coexist in the same consumer, rather than creating
   * separate fixture projects. The actual default native Program loads both
   * positive and negative sources once; JSX and noUnusedLocals retain their
   * incompatible compiler options. Each response selects its original graph.
   *
   * @evidence contracts/common.md#principled-implementation The checked-in corpus preserves each authored UTF-8 source/configuration string and relative filename. Population prefixes retain their disjoint selected members and public config imports within the actual shared consumer.
   * @evidence contracts/common.md#clear-and-simple-design One immutable text corpus replaces separate scenario trees; the reader returns a fresh relative-path map while ConsumerBatch owns membership and the caller owns actual compiler lifetimes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No status, diagnostic, producer identity or expected product output is supplied. Invalid text entries and missing populations fail instead of silently reducing selected input.
   * @evidence contracts/common.md#meaningful-documentation Distinguishes one shared fixture population from its named conditions, and records the three actual compiler-option families rather than equating file counts with Program counts.
   * @evidence contracts/performance.md#efficient-algorithms Parses the finite authored text map once and scans its entries to construct each selected population; it creates no compiler, installation or process.
   * @evidence contracts/performance.md#reuse-equivalent-work Only immutable authored input text is retained. Every returned map is fresh; actual native responses, mutable consumer files and SDK registration lookups remain caller-owned and uncached here.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retains only the finite static text corpus, opens no persistent handles and owns no temporary directory or child. Actual consumer and native-child cleanup remains with the E2E owner.
   * @evidence contracts/portability.md#os-neutral-implementation The corpus file is resolved relative to this module and population keys use slash separators. Validated relative keys and exact prefix selection preserve authored paths without shell interpolation or platform-specific fixture links.
   */
  export function read(population: string): Record<string, string> {
    if (!population.startsWith("evidence/"))
      throw new Error("Unknown Evidence consumer population: " + population);
    const prefix = population.slice("evidence/".length) + "/";
    const selected = corpus
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, text]) => [name.slice(prefix.length), text] as const);
    if (selected.length === 0)
      throw new Error("Empty Evidence consumer population: " + population);
    return Object.fromEntries(selected);
  }
}
