/**
 * Token kinds used by {@link factory} and {@link TsPrinter}.
 *
 * This is an outline of the legacy `ts.SyntaxKind` enum: it only enumerates the
 * keyword / modifier / operator tokens that this hand-written factory and
 * printer understand. The numeric values are NOT meaningful and do not match
 * the legacy compiler — only the members and their textual rendering matter
 * here.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export enum SyntaxKind {
  // keyword type nodes & literal keywords
  AnyKeyword,
  UnknownKeyword,
  NumberKeyword,
  BigIntKeyword,
  ObjectKeyword,
  BooleanKeyword,
  StringKeyword,
  SymbolKeyword,
  VoidKeyword,
  UndefinedKeyword,
  NullKeyword,
  NeverKeyword,
  TrueKeyword,
  FalseKeyword,
  ThisKeyword,

  // modifiers
  ExportKeyword,
  DefaultKeyword,
  DeclareKeyword,
  AbstractKeyword,
  AsyncKeyword,
  ConstKeyword,
  PublicKeyword,
  PrivateKeyword,
  ProtectedKeyword,
  ReadonlyKeyword,
  StaticKeyword,
  OverrideKeyword,
  AccessorKeyword,

  // heritage / type operators / word operators
  ExtendsKeyword,
  ImplementsKeyword,
  KeyOfKeyword,
  UniqueKeyword,
  AssertsKeyword,
  AwaitKeyword,
  ImportKeyword,
  NewKeyword,
  SuperKeyword,
  InKeyword,
  InstanceOfKeyword,
  AsKeyword,
  SatisfiesKeyword,
  TypeOfKeyword,

  // punctuation
  DotDotDotToken,
  QuestionToken,
  QuestionDotToken,
  ColonToken,
  CommaToken,
  EqualsGreaterThanToken,

  // arithmetic / unary
  PlusToken,
  MinusToken,
  AsteriskToken,
  AsteriskAsteriskToken,
  SlashToken,
  PercentToken,
  PlusPlusToken,
  MinusMinusToken,
  ExclamationToken,
  TildeToken,

  // bitwise
  AmpersandToken,
  BarToken,
  CaretToken,
  LessThanLessThanToken,
  GreaterThanGreaterThanToken,
  GreaterThanGreaterThanGreaterThanToken,

  // relational / equality / logical
  LessThanToken,
  LessThanEqualsToken,
  GreaterThanToken,
  GreaterThanEqualsToken,
  EqualsEqualsToken,
  EqualsEqualsEqualsToken,
  ExclamationEqualsToken,
  ExclamationEqualsEqualsToken,
  AmpersandAmpersandToken,
  BarBarToken,
  QuestionQuestionToken,

  // assignment
  EqualsToken,
  PlusEqualsToken,
  MinusEqualsToken,
  AsteriskEqualsToken,
  SlashEqualsToken,
}
