import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { canonicalDigest, withoutDocumentation } from "./canonicalDigest";

const MAX_SCHEMA_BYTES: number = 16 * 1024 * 1024;
const ANSI_PATTERN: RegExp = /\x1b\[[0-9;]*m/gu;

/**
 * The separator between a path and its hash inside the composite digest.
 *
 * NUL, because a path may contain a space while a hex digest contains nothing
 * outside `[0-9a-f]` — an ambiguous separator would let two different sets
 * compose one key, which is the single thing a cache key may not do. The native
 * side writes the same byte.
 *
 * Both sides spell it as an escape rather than as a literal on purpose. This
 * was a literal control character once, and the two implementations then
 * disagreed on a byte neither source showed, in the one place where a
 * disagreement produces no error and no wrong answer — only a cache that never
 * hits again.
 */
const SEPARATOR: string = "\u0000";

interface IPrismaSchemaInventory {
  id: string;
  models: IPrismaModel[];
  digest: string;
}

interface IPrismaSchemaProblem {
  id: string;
  message: string;
  digest: string;
}

interface IPrismaModel {
  name: string;
  documentation: string;
  /**
   * The model's own declaration, digested where it is understood.
   *
   * Its fields are not folded in. A field is a unit of its own, and the scope a
   * review of the model covers is composed from those units on the native side,
   * so folding them here would make one field's edit expire a review of every
   * sibling as well as of the model.
   */
  digest: string;
  fields: IPrismaField[];
}

/**
 * One member of a model, already classified in this graph's vocabulary.
 *
 * Prisma spells the distinction as `kind: "scalar" | "object"`, and translating
 * it here rather than natively is what keeps Prisma's vocabulary out of the Go
 * side entirely — the process boundary carries unit identities, exactly as the
 * Swagger bridge carries operation identities.
 */
interface IPrismaField {
  name: string;
  symbol: "column" | "relation";
  documentation: string;
  /**
   * The field's own declaration, digested where it is understood.
   *
   * The parser is the only side that sees a field's type, its attributes, and
   * their arguments. Reading them from the parsed value rather than from text
   * is the same subordination the position scan already obeys: the parser
   * answers what exists, and nothing else is allowed to.
   */
  digest: string;
}

/** The bytes one schema file set was read as, with the identity of those bytes. */
interface IReadSet {
  files: Array<[string, string]>;
  digest: string;
}

/**
 * Loads and classifies every configured Prisma schema set for the native rule.
 *
 * The native contributor is Go and Prisma's parser is a WebAssembly module with
 * a JavaScript entry point. This function is the narrow process boundary
 * between them: it accepts only file locations and returns only model, column,
 * and relation identities with their doc comments.
 *
 * One **set** is one request. A Prisma schema folder is several files that form
 * a single namespace — a model in one file may point at a model in another — so
 * a file cannot be parsed alone and the reuse key belongs to the ordered set.
 *
 * @internal
 */
export const loadPrismaModels = async (request: {
  root: string;
  sets: Array<{ id: string; files: string[] }>;
}) => {
  const parser: IPrismaParser = resolveParser(request.root);
  const loaded: Array<IPrismaSchemaInventory | IPrismaSchemaProblem> =
    await Promise.all(
      request.sets.map(async (set) => {
        let digest: string = "";
        try {
          const read: IReadSet = await readSet(request.root, set.files);
          digest = read.digest;
          return {
            id: set.id,
            models: modelsOf(parser, read.files),
            digest,
          } satisfies IPrismaSchemaInventory;
        } catch (error) {
          return {
            id: set.id,
            message: errorMessage(error),
            digest,
          } satisfies IPrismaSchemaProblem;
        }
      }),
    );
  return {
    documents: loaded.filter(isInventory),
    problems: loaded.filter(isProblem),
  };
};

interface IPrismaParser {
  get_datamodel: (params: string) => string;
  version: string;
  origin: "project" | "plugin";
}

/**
 * Resolves the schema parser, preferring the one the consumer's project can
 * see.
 *
 * The preference is not politeness. A parser build validates the schema it
 * parses, and Prisma's own rules move between major versions — a Prisma 7 build
 * rejects a `datasource` block containing `url`, which every Prisma 6 schema
 * has. Parsing a consumer's schema with a parser they did not choose therefore
 * turns a valid schema into a build failure, so their copy wins whenever one
 * exists and the pinned dependency is only the fallback.
 *
 * Which one answered is carried on the parser, because a rejection produced by
 * the fallback needs to say so; a reader whose schema is fine has no other way
 * to learn that the verdict came from a version they never installed.
 */
const resolveParser = (root: string): IPrismaParser => {
  const failures: string[] = [];
  for (const origin of ["project", "plugin"] as const) {
    try {
      const resolver: NodeRequire =
        origin === "project"
          ? createRequire(path.join(root, "package.json"))
          : createRequire(__filename);
      const manifest: { version?: string } = resolver(
        "@prisma/prisma-schema-wasm/package.json",
      );
      const wasm: { get_datamodel?: unknown } = resolver(
        "@prisma/prisma-schema-wasm",
      );
      if (typeof wasm.get_datamodel !== "function")
        throw new Error("the module exposes no get_datamodel export");
      return {
        get_datamodel: wasm.get_datamodel as (params: string) => string,
        version: manifest.version ?? "unknown",
        origin,
      };
    } catch (error) {
      failures.push(`${origin}: ${errorMessage(error)}`);
    }
  }
  throw new Error(
    `no Prisma schema parser could be resolved (${failures.join("; ")})`,
  );
};

const readSet = async (root: string, sources: string[]): Promise<IReadSet> => {
  const files: Array<[string, string]> = [];
  // Hashed as it goes, over the bytes as they were read and in the order the
  // caller sent. The native side composes the same digest from the same
  // per-file hashes, so the two agree by construction; hashing the decoded text
  // instead would agree only where the round trip happens to be exact.
  const composite: ReturnType<typeof createHash> = createHash("sha256");
  for (const source of sources) {
    // A schema file may sit above the project or on an absolute path, because a
    // population resolves against the root its configuration declares rather
    // than against the project. The caller sends the paths its own walk
    // produced, so this side only resolves them the same way.
    const location: string = path.resolve(root, source);
    const stat: Awaited<ReturnType<typeof fs.stat>> = await fs.stat(location);
    if (!stat.isFile())
      throw new Error(`the Prisma schema source '${source}' is not a file`);
    if (stat.size > MAX_SCHEMA_BYTES)
      throw new Error(
        `the Prisma schema '${source}' exceeds the ${MAX_SCHEMA_BYTES} byte limit`,
      );

    const content: Buffer = await fs.readFile(location);
    files.push([source, decodeUtf8(content)]);
    composite.update(source, "utf8");
    composite.update(SEPARATOR);
    composite.update(createHash("sha256").update(content).digest("hex"));
    composite.update("\n");
  }
  return { files, digest: composite.digest("hex") };
};

const decodeUtf8 = (content: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(content);

/**
 * Runs the parser over one whole set and classifies what it declares.
 *
 * `get_datamodel` is used rather than the full DMMF deliberately. Measured on a
 * 200-model schema, the datamodel answers in 11 ms and 369 KB while the full
 * DMMF takes 262 ms and 16 MB — and that payload has to cross a process
 * boundary as JSON. Nothing in the extra 16 MB is a unit this graph can cite.
 */
const modelsOf = (
  parser: IPrismaParser,
  files: Array<[string, string]>,
): IPrismaModel[] => {
  let payload: string;
  try {
    payload = parser.get_datamodel(JSON.stringify({ prismaSchema: files }));
  } catch (error) {
    throw new Error(
      `${parserFailure(error)} (parsed by @prisma/prisma-schema-wasm@${parser.version} resolved from the ${parser.origin})`,
    );
  }
  const datamodel: {
    models?: Array<{
      name?: unknown;
      documentation?: unknown;
      fields?: Array<{
        name?: unknown;
        kind?: unknown;
        documentation?: unknown;
      }>;
    }>;
  } = JSON.parse(payload);
  const models: IPrismaModel[] = [];
  for (const model of datamodel.models ?? []) {
    if (typeof model.name !== "string" || model.name.length === 0) continue;
    models.push({
      name: model.name,
      documentation:
        typeof model.documentation === "string" ? model.documentation : "",
      // The model's own declaration is everything the parser reports about it
      // except its fields, which are units in their own right, and except its
      // documentation, which is where a review of it is written.
      digest: canonicalDigest(
        withoutDocumentation(model, "documentation", "fields"),
      ),
      fields: (model.fields ?? [])
        .filter(
          (
            field,
          ): field is {
            name: string;
            kind: unknown;
            documentation?: unknown;
          } => typeof field.name === "string" && field.name.length !== 0,
        )
        .map((field) => ({
          name: field.name,
          // Prisma classifies a relation field as `object`; everything a table
          // actually stores is `scalar`. An `enum`-typed field stores a value
          // and is therefore a column, which is why the test is for `object`
          // rather than for `scalar`.
          symbol: field.kind === "object" ? "relation" : "column",
          documentation:
            typeof field.documentation === "string" ? field.documentation : "",
          digest: canonicalDigest(withoutDocumentation(field, "documentation")),
        })),
    });
  }
  return models;
};

/**
 * Unwraps the parser's own error into the sentence its author has to act on.
 *
 * A rejection arrives as an `Error` whose message is a JSON envelope carrying
 * an error code and an ANSI-coloured report — and that report is the one place
 * a location survives at all, because a successful parse carries no positions.
 * Both halves are preserved: the colour codes are stripped because a diagnostic
 * stream is not a terminal, and the text is not, because it names the line.
 */
const parserFailure = (error: unknown): string => {
  const raw: string = errorMessage(error);
  try {
    const envelope: { message?: unknown } = JSON.parse(raw);
    if (typeof envelope.message === "string")
      return envelope.message.replace(ANSI_PATTERN, "").trim();
  } catch {
    // Not an envelope; the raw message is the whole of what is known.
  }
  return raw.replace(ANSI_PATTERN, "").trim();
};

const isInventory = (
  value: IPrismaSchemaInventory | IPrismaSchemaProblem,
): value is IPrismaSchemaInventory => "models" in value;

const isProblem = (
  value: IPrismaSchemaInventory | IPrismaSchemaProblem,
): value is IPrismaSchemaProblem => "message" in value;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
