/**
 * Token kinds used by {@link factory} and {@link TsPrinter}.
 *
 * An outline of the legacy `ts.SyntaxKind`: it enumerates only the keyword /
 * modifier / operator tokens this hand-written factory and printer understand.
 * Each member's value is its **own source text** (e.g. `QuestionToken = "?"`),
 * so a token renders to source by reading its value directly — no lookup table.
 * It is a string-valued `const enum`, so references inline to the literal with
 * no runtime object.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export const enum SyntaxKind {
  // keyword type nodes & literal keywords
  AnyKeyword = "any",
  UnknownKeyword = "unknown",
  NumberKeyword = "number",
  BigIntKeyword = "bigint",
  ObjectKeyword = "object",
  BooleanKeyword = "boolean",
  StringKeyword = "string",
  SymbolKeyword = "symbol",
  VoidKeyword = "void",
  UndefinedKeyword = "undefined",
  NullKeyword = "null",
  NeverKeyword = "never",
  TrueKeyword = "true",
  FalseKeyword = "false",
  ThisKeyword = "this",

  // modifiers
  ExportKeyword = "export",
  DefaultKeyword = "default",
  DeclareKeyword = "declare",
  AbstractKeyword = "abstract",
  AsyncKeyword = "async",
  ConstKeyword = "const",
  PublicKeyword = "public",
  PrivateKeyword = "private",
  ProtectedKeyword = "protected",
  ReadonlyKeyword = "readonly",
  StaticKeyword = "static",
  OverrideKeyword = "override",
  AccessorKeyword = "accessor",

  // heritage / type operators / word operators
  ExtendsKeyword = "extends",
  ImplementsKeyword = "implements",
  KeyOfKeyword = "keyof",
  UniqueKeyword = "unique",
  AssertsKeyword = "asserts",
  AwaitKeyword = "await",
  ImportKeyword = "import",
  NewKeyword = "new",
  SuperKeyword = "super",
  InKeyword = "in",
  InstanceOfKeyword = "instanceof",
  AsKeyword = "as",
  SatisfiesKeyword = "satisfies",
  TypeOfKeyword = "typeof",

  // punctuation
  DotDotDotToken = "...",
  QuestionToken = "?",
  QuestionDotToken = "?.",
  ColonToken = ":",
  CommaToken = ",",
  EqualsGreaterThanToken = "=>",

  // arithmetic / unary
  PlusToken = "+",
  MinusToken = "-",
  AsteriskToken = "*",
  AsteriskAsteriskToken = "**",
  SlashToken = "/",
  PercentToken = "%",
  PlusPlusToken = "++",
  MinusMinusToken = "--",
  ExclamationToken = "!",
  TildeToken = "~",

  // bitwise
  AmpersandToken = "&",
  BarToken = "|",
  CaretToken = "^",
  LessThanLessThanToken = "<<",
  GreaterThanGreaterThanToken = ">>",
  GreaterThanGreaterThanGreaterThanToken = ">>>",

  // relational / equality / logical
  LessThanToken = "<",
  LessThanEqualsToken = "<=",
  GreaterThanToken = ">",
  GreaterThanEqualsToken = ">=",
  EqualsEqualsToken = "==",
  EqualsEqualsEqualsToken = "===",
  ExclamationEqualsToken = "!=",
  ExclamationEqualsEqualsToken = "!==",
  AmpersandAmpersandToken = "&&",
  BarBarToken = "||",
  QuestionQuestionToken = "??",

  // assignment
  EqualsToken = "=",
  PlusEqualsToken = "+=",
  MinusEqualsToken = "-=",
  AsteriskEqualsToken = "*=",
  SlashEqualsToken = "/=",
  QuestionQuestionEqualsToken = "??=",

  // comment trivia (not real tokens; unique sentinels for the comment API)
  SingleLineCommentTrivia = "//",
  MultiLineCommentTrivia = "/*",
}
