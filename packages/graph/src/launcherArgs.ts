import path from "node:path";

/**
 * Invalid launcher syntax or a value outside the option's supported domain.
 *
 * @evidence contracts/common.md#principled-implementation An Error subtype gives callers a distinct argument-failure category while preserving the original diagnostic message.
 * @evidence contracts/common.md#clear-and-simple-design Only the error name differs; native Error owns stack and message behavior.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No global Error behavior is patched to classify launcher failures.
 * @evidence contracts/common.md#meaningful-documentation The native headline identifies the two supported causes without restating the class name.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Argument failure representation has no filesystem or process boundary.
 */
export class GraphArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GraphArgumentError";
  }
}

type OptionKind = "value" | "string" | "flag" | "boolean";

/**
 * One recognized launcher option and its accepted flag aliases.
 *
 * @evidence contracts/common.md#principled-implementation Key identifies the parsed value while aliases and kind determine accepted syntax.
 * @evidence contracts/common.md#clear-and-simple-design One definition owns aliases and parsing mode so launchers share the same parser.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Accepted tokens are explicit launcher grammar, not special cases for expected command output.
 * @evidence contracts/common.md#meaningful-documentation Native member comments distinguish result key, accepted tokens and value/flag/boolean parsing.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Option descriptors define token grammar; projectOptions owns native path resolution.
 */
export interface ILauncherOption {
  /** Canonical map key shared by every alias. */
  key: string;

  /** Accepted complete option tokens, including their leading hyphens. */
  flags: readonly string[];

  /** Value requires nonempty text; string preserves native empty/dash values. */
  kind: OptionKind;
}

/**
 * Parsed canonical option keys with textual or boolean values.
 *
 * @evidence contracts/common.md#principled-implementation ReadonlyMap represents absent options distinctly from false and empty text, with value kinds preserved.
 * @evidence contracts/common.md#clear-and-simple-design One map avoids separate alias-indexed result objects.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The public view is readonly rather than mutating consumer options during later validation.
 * @evidence contracts/common.md#meaningful-documentation The native headline explains canonical keys and the two stored value categories.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This readonly token map carries text and flags without native path interpretation.
 */
export type ParsedLauncherOptions = ReadonlyMap<string, string | boolean>;

/**
 * Project coordinates passed to the native graph producer.
 *
 * @evidence contracts/common.md#principled-implementation Absolute working directory and configuration locator determine which project the producer loads.
 * @evidence contracts/common.md#clear-and-simple-design Two shared coordinates prevent launcher lanes from owning competing project defaults.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Configuration remains caller-selected rather than pinned to a named repository.
 * @evidence contracts/common.md#meaningful-documentation Native member comments identify directory absoluteness and configuration relativity.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This result shape carries coordinates; projectOptions owns their native resolution.
 */
export interface IProjectOptions {
  /** Absolute project working directory. */
  cwd: string;

  /** Configuration path, relative to cwd unless already absolute. */
  tsconfig: string;
}

export const PROJECT_OPTIONS: readonly ILauncherOption[] = [
  { key: "cwd", flags: ["--cwd"], kind: "value" },
  { key: "tsconfig", flags: ["--tsconfig"], kind: "value" },
];

/**
 * Parse one complete launcher argument vector and reject every unknown token.
 *
 * Repeated aliases replace the prior canonical value. Missing values, values on
 * bare flags and unsupported boolean spellings throw GraphArgumentError.
 *
 * @evidence contracts/common.md#principled-implementation An alias map and ordered argument scan implement explicit option grammar; typed validators reject unsupported values without coercion.
 * @evidence contracts/common.md#clear-and-simple-design Definitions own grammar while private helpers own equals syntax, nonempty text and boolean spellings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Every token must match a configured option; unknown input is not silently accepted for a known fixture.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains repeated options and argument failures, with tags separated by a blank comment line.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Token parsing interprets no path and invokes no native process; projectOptions handles path-bearing options later.
 */
export function parseLauncherOptions(
  argv: readonly string[],
  definitions: readonly ILauncherOption[],
): ParsedLauncherOptions {
  const flags = new Map<string, ILauncherOption>();
  for (const definition of definitions) {
    for (const flag of definition.flags) flags.set(flag, definition);
  }

  const parsed = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const exact = flags.get(arg);
    if (exact !== undefined) {
      if (exact.kind === "value" || exact.kind === "string") {
        const value = argv[++i];
        if (value === undefined || (exact.kind === "value" && value.startsWith("-"))) {
          throw new GraphArgumentError(`${arg} requires a non-empty value`);
        }
        parsed.set(exact.key, exact.kind === "string" ? value : requireValue(arg, value));
      } else {
        parsed.set(exact.key, true);
      }
      continue;
    }

    const equals = findEqualsOption(arg, flags);
    if (equals === undefined) {
      throw new GraphArgumentError(`unknown option ${arg}`);
    }
    const { definition, flag, value } = equals;
    if (definition.kind === "flag") {
      throw new GraphArgumentError(`${flag} does not take a value`);
    }
    if (definition.kind === "boolean") {
      parsed.set(definition.key, parseBoolean(flag, value));
    } else {
      parsed.set(definition.key, definition.kind === "string" ? value : requireValue(flag, value));
    }
  }
  return parsed;
}

/**
 * Resolve the two project-selection values shared by every launcher lane.
 *
 * Defaults are the process directory and tsconfig.json; relative cwd values are
 * resolved before package lookup or native process invocation.
 *
 * @evidence contracts/common.md#principled-implementation Native path.resolve makes cwd absolute while the config retains the producer's cwd-relative convention.
 * @evidence contracts/common.md#clear-and-simple-design One adapter owns both shared defaults for all launcher lanes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Defaults are public launcher conventions rather than named-repository exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents defaults and resolution timing instead of only listing returned keys.
 * @evidence contracts/portability.md#os-neutral-implementation Node path.resolve applies the host's native path rules without manually concatenating separators.
 */
export function projectOptions(values: ParsedLauncherOptions): IProjectOptions {
  return {
    cwd: path.resolve(stringValue(values, "cwd") ?? process.cwd()),
    tsconfig: stringValue(values, "tsconfig") ?? "tsconfig.json",
  };
}

/**
 * Read a bounded non-negative integer option without JavaScript coercion.
 *
 * The value must be present, decimal digits and a safe integer no greater than
 * maximum. Missing parser state is an internal error; invalid text is an
 * argument error.
 *
 * @evidence contracts/common.md#principled-implementation Decimal syntax plus safe-integer and maximum checks exclude coercible nonintegers and precision loss before returning a number.
 * @evidence contracts/common.md#clear-and-simple-design One validator owns nonnegative parsing and is reused by the positive validator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Bounds are supplied by the option contract rather than expected fixture values.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains numeric domain and the distinction between missing state and invalid input.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Numeric option validation has no native filesystem or process operation.
 */
export function nonNegativeIntegerOption(
  values: ParsedLauncherOptions,
  key: string,
  maximum: number,
): number {
  const value = stringValue(values, key);
  if (value === undefined) {
    throw new Error(`Missing required parsed option ${key}`);
  }
  if (!/^\d+$/.test(value)) {
    throw new GraphArgumentError(`${optionName(key)} must be an integer`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum) {
    throw new GraphArgumentError(
      `${optionName(key)} must be between 0 and ${maximum}`,
    );
  }
  return number;
}

/**
 * Read a bounded positive integer option without JavaScript coercion.
 *
 * Uses the nonnegative validator and additionally rejects zero.
 *
 * @evidence contracts/common.md#principled-implementation Reusing safe nonnegative validation then excluding zero yields exactly the bounded positive-integer domain.
 * @evidence contracts/common.md#clear-and-simple-design The adapter adds one domain restriction rather than duplicating numeric parsing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Zero rejection follows the option domain, not a special expected command case.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the additional restriction and identifies the shared validator.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The positivity restriction is a platform-independent numeric predicate.
 */
export function positiveIntegerOption(
  values: ParsedLauncherOptions,
  key: string,
  maximum: number,
): number {
  const value = nonNegativeIntegerOption(values, key, maximum);
  if (value === 0) {
    throw new GraphArgumentError(`${optionName(key)} must be greater than 0`);
  }
  return value;
}

function findEqualsOption(
  arg: string,
  flags: ReadonlyMap<string, ILauncherOption>,
): { definition: ILauncherOption; flag: string; value: string } | undefined {
  for (const [flag, definition] of flags) {
    const prefix = `${flag}=`;
    if (arg.startsWith(prefix)) {
      return { definition, flag, value: arg.slice(prefix.length) };
    }
  }
  return undefined;
}

function requireValue(flag: string, value: string): string {
  if (value.trim() === "") {
    throw new GraphArgumentError(`${flag} requires a non-empty value`);
  }
  return value;
}

function parseBoolean(flag: string, value: string): boolean {
  switch (value) {
    case "1":
    case "t":
    case "T":
    case "TRUE":
    case "true":
    case "True":
      return true;
    case "0":
    case "f":
    case "F":
    case "FALSE":
    case "false":
    case "False":
      return false;
    default:
      throw new GraphArgumentError(`${flag} requires a boolean value`);
  }
}

function stringValue(
  values: ParsedLauncherOptions,
  key: string,
): string | undefined {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function optionName(key: string): string {
  return `--${key.replaceAll("_", "-")}`;
}
