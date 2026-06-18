import ttscFactory from "@ttsc/factory";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Prove that `@ttsc/factory` mirrors every non-deprecated **public** `create*`
 * member of the legacy `ts.factory`, against a real (legacy) `typescript`
 * install.
 *
 * The required surface is the public `NodeFactory` interface parsed from the
 * real `typescript.d.ts`. Two categories are exempt:
 *
 * - `@deprecated` members, detected by treating a name as deprecated only when
 *   _every_ one of its overloads carries an `@deprecated` JSDoc tag.
 * - `@internal` members, excluded automatically: the published `typescript.d.ts`
 *   strips `@internal` declarations, so keying off the public interface leaves
 *   them out. (They exist on `ts.factory` at runtime but are all replaceable
 *   sugar over public primitives or compiler-internal nodes, so there is no
 *   value in reimplementing them.)
 *
 * A companion test guards the reverse direction: every `create*` that
 * `@ttsc/factory` exposes must be a real `ts.factory` runtime member.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */

interface FactoryTally {
  /** Every `create*` member name on the public `NodeFactory` interface. */
  readonly all: ReadonlySet<string>;
  /** Names whose every overload is `@deprecated`. */
  readonly deprecated: ReadonlySet<string>;
}

/**
 * Parse the public `NodeFactory` interface from the real `typescript.d.ts`,
 * tallying its `create*` members and which are fully `@deprecated`.
 */
const publicFactoryTally = (): FactoryTally => {
  // `getDefaultLibFilePath` points inside the typescript `lib/` directory,
  // which also holds the bundled `typescript.d.ts`.
  const dts: string = path.join(
    path.dirname(ts.getDefaultLibFilePath({})),
    "typescript.d.ts",
  );
  const source: ts.SourceFile = ts.createSourceFile(
    "typescript.d.ts",
    fs.readFileSync(dts, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );

  const tally = new Map<string, { total: number; deprecated: number }>();
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === "NodeFactory")
      for (const member of node.members) {
        if (member.name === undefined || !ts.isIdentifier(member.name))
          continue;
        const name: string = member.name.text;
        if (!name.startsWith("create")) continue;
        const deprecated: boolean = ts
          .getJSDocTags(member)
          .some((tag) => tag.tagName.text === "deprecated");
        const counter = tally.get(name) ?? { total: 0, deprecated: 0 };
        counter.total += 1;
        if (deprecated) counter.deprecated += 1;
        tally.set(name, counter);
      }
    ts.forEachChild(node, visit);
  };
  visit(source);

  const all = new Set<string>(tally.keys());
  const deprecated = new Set<string>();
  for (const [name, counter] of tally)
    if (counter.total > 0 && counter.total === counter.deprecated)
      deprecated.add(name);
  return { all, deprecated };
};

/** `create*` members implemented by `@ttsc/factory`. */
const ttscFactoryNames = (): ReadonlySet<string> =>
  new Set(Object.keys(ttscFactory).filter((key) => key.startsWith("create")));

/**
 * Every `create*` member on the real `ts.factory` at runtime (incl.
 * `@internal`).
 */
const runtimeFactoryNames = (): ReadonlySet<string> =>
  new Set(Object.keys(ts.factory).filter((key) => key.startsWith("create")));

/**
 * Every non-deprecated public `ts.factory.create*` function is implemented by
 * `@ttsc/factory`.
 */
export const test_factory_completeness = (): void => {
  const { all, deprecated }: FactoryTally = publicFactoryTally();
  const ttsc: ReadonlySet<string> = ttscFactoryNames();

  const missing: string[] = [...all]
    .filter((name) => !deprecated.has(name))
    .filter((name) => !ttsc.has(name))
    .sort();
  if (missing.length !== 0)
    throw new Error(
      `@ttsc/factory is missing ${missing.length} non-deprecated public ` +
        `ts.factory function(s):\n${missing.map((n) => `  - ${n}`).join("\n")}`,
    );
};

/**
 * The reverse guard: every `create*` that `@ttsc/factory` exposes must be a
 * real `ts.factory` member.
 *
 * This fails loudly if a factory function is invented (a typo, or a name that
 * never existed in the legacy compiler), so the surface can only ever be a
 * subset of the genuine runtime `ts.factory`.
 */
export const test_factory_has_no_phantom_functions = (): void => {
  const real: ReadonlySet<string> = runtimeFactoryNames();
  const phantom: string[] = [...ttscFactoryNames()]
    .filter((name) => !real.has(name))
    .sort();
  if (phantom.length !== 0)
    throw new Error(
      `@ttsc/factory exposes ${phantom.length} create* function(s) absent from ` +
        `the real ts.factory:\n${phantom.map((n) => `  - ${n}`).join("\n")}`,
    );
};
