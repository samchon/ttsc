import ttscFactory from "@ttsc/factory";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Prove that `@ttsc/factory` mirrors **every** non-deprecated `create*` member
 * of the legacy `ts.factory`, against a real (legacy) `typescript` install.
 *
 * The check is deliberately exhaustive: if even a single non-deprecated factory
 * function is missing, it throws an error listing the whole gap. The ONLY
 * category exempt from implementation is `@deprecated` — detected automatically
 * by parsing the real `typescript.d.ts` and treating a name as deprecated only
 * when _every_ one of its `NodeFactory` overloads carries an `@deprecated`
 * JSDoc tag. Everything else (including `@internal` runtime-only helpers, JSX
 * and JSDoc node builders) must be implemented.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */

/** All `create*` members present on the real `ts.factory` at runtime. */
const realFactoryNames = (): string[] =>
  Object.keys(ts.factory).filter((key) => key.startsWith("create"));

/**
 * Names whose _every_ `NodeFactory` overload is `@deprecated`, parsed from the
 * real `typescript.d.ts`.
 */
const deprecatedFactoryNames = (): ReadonlySet<string> => {
  // `getDefaultLibFilePath` points inside the typescript `lib/` directory,
  // which also holds the bundled `typescript.d.ts` — resolved without relying
  // on `import.meta` / `require`.
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

  const names = new Set<string>();
  for (const [name, counter] of tally)
    if (counter.total > 0 && counter.total === counter.deprecated)
      names.add(name);
  return names;
};

/** `create*` members implemented by `@ttsc/factory`. */
const ttscFactoryNames = (): ReadonlySet<string> =>
  new Set(Object.keys(ttscFactory).filter((key) => key.startsWith("create")));

/**
 * Every non-deprecated `ts.factory.create*` function is implemented by
 * `@ttsc/factory`.
 */
export const test_factory_completeness = (): void => {
  const real: string[] = realFactoryNames();
  const deprecated: ReadonlySet<string> = deprecatedFactoryNames();
  const ttsc: ReadonlySet<string> = ttscFactoryNames();

  const missing: string[] = real
    .filter((name) => !deprecated.has(name))
    .filter((name) => !ttsc.has(name))
    .sort();
  if (missing.length !== 0)
    throw new Error(
      `@ttsc/factory is missing ${missing.length} non-deprecated ts.factory ` +
        `function(s):\n${missing.map((name) => `  - ${name}`).join("\n")}`,
    );
};

/**
 * The reverse guard: every `create*` that `@ttsc/factory` exposes must be a real
 * `ts.factory` member.
 *
 * This fails loudly if a factory function is invented (a typo, or a name that
 * never existed in the legacy compiler), so the surface can only ever be a
 * subset of the genuine `ts.factory`.
 */
export const test_factory_has_no_phantom_functions = (): void => {
  const real: ReadonlySet<string> = new Set(realFactoryNames());
  const phantom: string[] = [...ttscFactoryNames()]
    .filter((name) => !real.has(name))
    .sort();
  if (phantom.length !== 0)
    throw new Error(
      `@ttsc/factory exposes ${phantom.length} create* function(s) absent from ` +
        `the real ts.factory:\n${phantom.map((name) => `  - ${name}`).join("\n")}`,
    );
};
