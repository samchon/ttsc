import fs from "node:fs";

/** One predeclared `disabled` marker and the claim it holds shut. */
export interface IActivationGate {
  /** Configured claim name the marker belongs to. */
  readonly claim: string;

  /** Absolute path of the configuration that declares it. */
  readonly file: string;
}

/**
 * Reads every claim name a graph configuration declares, in file order.
 *
 * Names come from the file rather than from a list kept here, so a claim added
 * to or renamed in the template is one this suite immediately holds to the same
 * standard instead of quietly ignoring.
 */
export const readClaimNames = (file: string): string[] => {
  const names: string[] = [];
  for (const line of lines(file)) {
    const matched: RegExpExecArray | null = /^\s*name:\s*"([^"]+)",?\s*$/.exec(
      line,
    );
    if (matched?.[1] !== undefined) names.push(matched[1]);
  }
  return names;
};

/**
 * Reads which claims reference an installed package rather than local sources.
 *
 * A `package` reference is the one that reaches through the install, so it is
 * the one a workspace link can hide: pnpm writes a junction for a workspace
 * dependency, and a walker that treats the junction as a plain entry returns an
 * empty population that demands nothing. Naming these claims from the
 * configuration rather than from a list kept here is what lets a case hold
 * exactly the claims that carry that risk, and hold a new one automatically.
 */
export const readClaimsReferencingAPackage = (file: string): string[] => {
  const found: string[] = [];
  let claim: string = "";
  for (const line of lines(file)) {
    const named: RegExpExecArray | null = /^\s*name:\s*"([^"]+)",?\s*$/.exec(
      line,
    );
    if (named?.[1] !== undefined) {
      claim = named[1];
      continue;
    }
    if (!/^\s*package:\s*"/.test(line) || claim === "") continue;
    if (!found.includes(claim)) found.push(claim);
  }
  return found;
};

/** Reads every activation marker a graph configuration ships, in file order. */
export const readActivationGates = (file: string): IActivationGate[] => {
  const source: string[] = lines(file);
  const gates: IActivationGate[] = [];
  let claim: string = "";
  for (let index = 0; index < source.length; index++) {
    const line: string = source[index] ?? "";
    const named: RegExpExecArray | null = /^\s*name:\s*"([^"]+)",?\s*$/.exec(
      line,
    );
    if (named?.[1] !== undefined) {
      claim = named[1];
      continue;
    }
    if (!/^\s*disabled:\s*true,?\s*$/.test(line)) continue;
    if (claim === "")
      throw new Error(
        `${file} declares a disabled marker at line ${index + 1} that belongs to no named claim.`,
      );
    gates.push({ claim, file });
  }
  return gates;
};

/**
 * Deletes one claim's activation marker and the comment that explains it.
 *
 * This is the Evidence arm's one prescribed edit to a frozen configuration —
 * the benchmark skill's `lint.config.ts` tamper check discards exactly the
 * `disabled:` lines and pure comments before reporting whatever remains — so
 * removing anything else here would make a case exercise an edit that stops a
 * cell from being measured.
 *
 * The file is re-read on every call rather than remembered, because removing an
 * earlier marker moves every line below it.
 */
export const removeActivationGate = (file: string, claim: string): void => {
  const source: string[] = lines(file);
  let current: string = "";
  for (let index = 0; index < source.length; index++) {
    const line: string = source[index] ?? "";
    const named: RegExpExecArray | null = /^\s*name:\s*"([^"]+)",?\s*$/.exec(
      line,
    );
    if (named?.[1] !== undefined) {
      current = named[1];
      continue;
    }
    if (!/^\s*disabled:\s*true,?\s*$/.test(line) || current !== claim) continue;
    const comment: readonly string[] = commentRunAbove(source, index);
    source.splice(index - comment.length, comment.length + 1);
    fs.writeFileSync(file, source.join("\n"), "utf8");
    return;
  }
  throw new Error(
    `${file} declares no disabled marker for claim '${claim}'; the configuration changed shape.`,
  );
};

const commentRunAbove = (
  source: readonly string[],
  index: number,
): string[] => {
  const comment: string[] = [];
  for (let above = index - 1; above >= 0; above--) {
    const line: string = source[above] ?? "";
    if (!/^\s*\/\//.test(line)) break;
    comment.unshift(line.trim());
  }
  return comment;
};

const lines = (file: string): string[] =>
  fs.readFileSync(file, "utf8").split("\n");
