import { SyntaxKind } from "./SyntaxKind";

const TEXTS: { [key in SyntaxKind]: string } = {
  [SyntaxKind.AnyKeyword]: "any",
  [SyntaxKind.UnknownKeyword]: "unknown",
  [SyntaxKind.NumberKeyword]: "number",
  [SyntaxKind.BigIntKeyword]: "bigint",
  [SyntaxKind.ObjectKeyword]: "object",
  [SyntaxKind.BooleanKeyword]: "boolean",
  [SyntaxKind.StringKeyword]: "string",
  [SyntaxKind.SymbolKeyword]: "symbol",
  [SyntaxKind.VoidKeyword]: "void",
  [SyntaxKind.UndefinedKeyword]: "undefined",
  [SyntaxKind.NullKeyword]: "null",
  [SyntaxKind.NeverKeyword]: "never",
  [SyntaxKind.TrueKeyword]: "true",
  [SyntaxKind.FalseKeyword]: "false",
  [SyntaxKind.ThisKeyword]: "this",

  [SyntaxKind.ExportKeyword]: "export",
  [SyntaxKind.DefaultKeyword]: "default",
  [SyntaxKind.DeclareKeyword]: "declare",
  [SyntaxKind.AbstractKeyword]: "abstract",
  [SyntaxKind.AsyncKeyword]: "async",
  [SyntaxKind.ConstKeyword]: "const",
  [SyntaxKind.PublicKeyword]: "public",
  [SyntaxKind.PrivateKeyword]: "private",
  [SyntaxKind.ProtectedKeyword]: "protected",
  [SyntaxKind.ReadonlyKeyword]: "readonly",
  [SyntaxKind.StaticKeyword]: "static",
  [SyntaxKind.OverrideKeyword]: "override",
  [SyntaxKind.AccessorKeyword]: "accessor",

  [SyntaxKind.ExtendsKeyword]: "extends",
  [SyntaxKind.ImplementsKeyword]: "implements",
  [SyntaxKind.KeyOfKeyword]: "keyof",
  [SyntaxKind.UniqueKeyword]: "unique",
  [SyntaxKind.AssertsKeyword]: "asserts",
  [SyntaxKind.AwaitKeyword]: "await",
  [SyntaxKind.ImportKeyword]: "import",
  [SyntaxKind.NewKeyword]: "new",
  [SyntaxKind.SuperKeyword]: "super",
  [SyntaxKind.InKeyword]: "in",
  [SyntaxKind.InstanceOfKeyword]: "instanceof",
  [SyntaxKind.AsKeyword]: "as",
  [SyntaxKind.SatisfiesKeyword]: "satisfies",
  [SyntaxKind.TypeOfKeyword]: "typeof",

  [SyntaxKind.DotDotDotToken]: "...",
  [SyntaxKind.QuestionToken]: "?",
  [SyntaxKind.QuestionDotToken]: "?.",
  [SyntaxKind.ColonToken]: ":",
  [SyntaxKind.CommaToken]: ",",
  [SyntaxKind.EqualsGreaterThanToken]: "=>",

  [SyntaxKind.PlusToken]: "+",
  [SyntaxKind.MinusToken]: "-",
  [SyntaxKind.AsteriskToken]: "*",
  [SyntaxKind.AsteriskAsteriskToken]: "**",
  [SyntaxKind.SlashToken]: "/",
  [SyntaxKind.PercentToken]: "%",
  [SyntaxKind.PlusPlusToken]: "++",
  [SyntaxKind.MinusMinusToken]: "--",
  [SyntaxKind.ExclamationToken]: "!",
  [SyntaxKind.TildeToken]: "~",

  [SyntaxKind.AmpersandToken]: "&",
  [SyntaxKind.BarToken]: "|",
  [SyntaxKind.CaretToken]: "^",
  [SyntaxKind.LessThanLessThanToken]: "<<",
  [SyntaxKind.GreaterThanGreaterThanToken]: ">>",
  [SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: ">>>",

  [SyntaxKind.LessThanToken]: "<",
  [SyntaxKind.LessThanEqualsToken]: "<=",
  [SyntaxKind.GreaterThanToken]: ">",
  [SyntaxKind.GreaterThanEqualsToken]: ">=",
  [SyntaxKind.EqualsEqualsToken]: "==",
  [SyntaxKind.EqualsEqualsEqualsToken]: "===",
  [SyntaxKind.ExclamationEqualsToken]: "!=",
  [SyntaxKind.ExclamationEqualsEqualsToken]: "!==",
  [SyntaxKind.AmpersandAmpersandToken]: "&&",
  [SyntaxKind.BarBarToken]: "||",
  [SyntaxKind.QuestionQuestionToken]: "??",

  [SyntaxKind.EqualsToken]: "=",
  [SyntaxKind.PlusEqualsToken]: "+=",
  [SyntaxKind.MinusEqualsToken]: "-=",
  [SyntaxKind.AsteriskEqualsToken]: "*=",
  [SyntaxKind.SlashEqualsToken]: "/=",
};

/** Render a {@link SyntaxKind} token to its source text (e.g. `===`, `string`). */
export const tokenToString = (kind: SyntaxKind): string => {
  const text: string | undefined = TEXTS[kind];
  if (text === undefined)
    throw new Error(`@ttsc/factory: unknown SyntaxKind token (${kind}).`);
  return text;
};
