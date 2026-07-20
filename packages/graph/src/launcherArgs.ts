import path from "node:path";

export class GraphArgumentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GraphArgumentError";
  }
}

type OptionKind = "value" | "flag" | "boolean";

export interface ILauncherOption {
  key: string;
  flags: readonly string[];
  kind: OptionKind;
}

export type ParsedLauncherOptions = ReadonlyMap<string, string | boolean>;

export interface IProjectOptions {
  cwd: string;
  tsconfig: string;
}

export const PROJECT_OPTIONS: readonly ILauncherOption[] = [
  { key: "cwd", flags: ["--cwd"], kind: "value" },
  { key: "tsconfig", flags: ["--tsconfig"], kind: "value" },
];

/** Parse one complete launcher argument vector and reject every unknown token. */
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
      if (exact.kind === "value") {
        const value = argv[++i];
        if (value === undefined || value.startsWith("-")) {
          throw new GraphArgumentError(`${arg} requires a non-empty value`);
        }
        parsed.set(exact.key, requireValue(arg, value));
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
      parsed.set(definition.key, requireValue(flag, value));
    }
  }
  return parsed;
}

/** Resolve the two project-selection values shared by every launcher lane. */
export function projectOptions(values: ParsedLauncherOptions): IProjectOptions {
  return {
    cwd: path.resolve(stringValue(values, "cwd") ?? process.cwd()),
    tsconfig: stringValue(values, "tsconfig") ?? "tsconfig.json",
  };
}

/** Read a bounded non-negative integer option without JavaScript coercion. */
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

/** Read a bounded positive integer option without JavaScript coercion. */
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
