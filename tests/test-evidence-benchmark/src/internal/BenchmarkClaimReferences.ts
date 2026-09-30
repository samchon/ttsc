import fs from "node:fs";
import ts from "ts-legacy";

/** Authored claim reference syntax, independent of emitted obligations. */
export namespace BenchmarkClaimReferences {
  /**
   * Read reference kinds from the authored claim, before observing its obligations.
   *
   * Frozen configurations declare literal claim arrays and literal single or array
   * references. Unsupported expressions, missing claims and duplicate names fail
   * rather than assigning a kind from whichever diagnostics happened to arrive.
   *
   * @evidence contracts/common.md#principled-implementation TypeScript syntax nodes associate each literal claims-array member with its own name and reference type; single and array references preserve their declared order independently of diagnostics.
   * @evidence contracts/common.md#clear-and-simple-design One namespace owns configuration syntax reading and its private literal-property guards; consumers receive only the declared reference kinds they need.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Authored configuration bytes are parsed without executing configuration code, substituting a compiler, or guessing reference kinds from observed targets; unsupported shapes reject explicitly.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the supported literal syntax and explains why missing or ambiguous declarations must reject.
   * @evidence contracts/performance.md#efficient-algorithms One parse and syntax traversal find the named claim; its reference list is scanned once, with no retained configuration cache across edits.
   * @evidence contracts/portability.md#os-neutral-implementation Node reads the supplied native filename and TypeScript parses its bytes; reference kinds are protocol strings independent of host path spelling.
   */
  export function read(file: string, claim: string): string[] {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const matches: ts.ObjectLiteralExpression[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAssignment(node) && propertyName(node.name) === "claims") {
        if (!ts.isArrayLiteralExpression(node.initializer))
          throw new Error(`Claims in ${file} must be a literal array.`);
        for (const member of node.initializer.elements) {
          if (!ts.isObjectLiteralExpression(member))
            throw new Error(`Claims in ${file} must contain literal objects.`);
          const name = property(member, "name");
          if (name === undefined || !ts.isStringLiteral(name))
            throw new Error(
              `Claim names in ${file} must be literal strings.`,
            );
          if (name.text === claim)
            matches.push(member);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (matches.length !== 1)
      throw new Error(
        `Expected one declaration of claim '${claim}' in ${file}; found ${matches.length}.`,
      );
    const reference = property(matches[0]!, "reference");
    if (reference === undefined)
      throw new Error(`Claim '${claim}' declares no reference in ${file}.`);
    const references = ts.isArrayLiteralExpression(reference)
      ? reference.elements
      : [reference];
    if (references.length === 0)
      throw new Error(
        `Claim '${claim}' declares an empty reference array in ${file}.`,
      );
    return references.map((entry) => {
      if (!ts.isObjectLiteralExpression(entry))
        throw new Error(
          `Claim '${claim}' reference must be a literal object in ${file}.`,
        );
      const type = property(entry, "type");
      if (type === undefined || !ts.isStringLiteral(type))
        throw new Error(
          `Claim '${claim}' reference type must be a literal string in ${file}.`,
        );
      return type.text;
    });
  }
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

function property(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined {
  for (const entry of object.properties)
    if (!ts.isPropertyAssignment(entry) || propertyName(entry.name) === undefined)
      throw new Error(
        "Claim configuration must use literal property assignments without spreads or computed names.",
      );
  const members = object.properties.filter(
    (entry) => entry.name !== undefined && propertyName(entry.name) === name,
  );
  if (members.length > 1)
    throw new Error(`Duplicate '${name}' property in claim configuration.`);
  const member = members[0];
  if (member === undefined) return undefined;
  if (!ts.isPropertyAssignment(member))
    throw new Error(`Claim configuration '${name}' must be a property assignment.`);
  return member.initializer;
}
