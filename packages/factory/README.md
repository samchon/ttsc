# @ttsc/factory

[![NPM Version](https://img.shields.io/npm/v/@ttsc/factory.svg)](https://www.npmjs.com/package/@ttsc/factory) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/factory.svg)](https://www.npmjs.com/package/@ttsc/factory) [![GitHub License](https://img.shields.io/github/license/samchon/ttsc.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![Build Status](https://github.com/samchon/ttsc/workflows/build/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Abuild)

Hand-written, dependency-free TypeScript **AST factory** and **printer** for source code generation.

```bash
npm install @ttsc/factory
```

```typescript
import factory, { TsPrinter } from "@ttsc/factory";

const node = factory.createCallExpression(
  factory.createPropertyAccessExpression(
    factory.createIdentifier("console"),
    factory.createIdentifier("log"),
  ),
  undefined,
  [factory.createStringLiteral("hello world")],
);

const printer = new TsPrinter();
console.log(printer.print(node));
// console.log("hello world")
```

## Why?

The legacy (`<= 6.x`, JavaScript based) TypeScript compiler exposes a node factory and a printer through its JavaScript API:

```typescript
import ts from "typescript";

const node = ts.factory.createStringLiteral("hello");
const text = ts.createPrinter().printNode(/* ... */);
```

Once a project migrates its tool-chain to the **TypeScript-Go** (tsgo, `>= 7.x`) native compiler, that JavaScript `ts.factory` / `ts.Printer` API is gone — so AST based code generation built on top of it breaks.

`@ttsc/factory` keeps that capability alive **without importing `typescript` at all**. The factory and printer are re-implemented directly, so the package has **zero dependencies** and works no matter which compiler builds the rest of your project.

## API

| Export | Description |
| --- | --- |
| `factory` (default export) | The node factory; `createXxx` mirror the legacy signatures. |
| `TsPrinter` | Renders factory nodes to TypeScript source text. |
| `SyntaxKind`, `NodeFlags` | Outline token & flag enums. |
| `addSyntheticLeadingComment` | Attach `//` / `/* */` comments to a node. |
| Outline AST types | `Expression`, `Statement`, `TypeNode`, `Node`, ... |

### `factory`

`createXxx` methods mirror the legacy `ts.factory` names and parameter order, and return concrete, fully typed _outline_ AST nodes (each with a `kind` discriminant).

```typescript
import factory, { SyntaxKind } from "@ttsc/factory";

factory.createKeywordTypeNode(SyntaxKind.StringKeyword); // string
```

### `TsPrinter`

A **width-aware** printer implemented directly (not a wrapper over `ts.Printer`). Like Prettier, it keeps lists on one line when they fit within `printWidth` and breaks them — with trailing commas — when they don't.

```typescript
const props: TsPrinter.IProps = {
  printWidth: 80, // default 80
  indent: "  ", //   default two spaces
  newLine: "\n", //  default LineFeed
};
const printer = new TsPrinter(props);

printer.print(node); // print one node (or a SourceFile)
printer.printNodes([a, b, c]); // print many nodes, joined by new lines
printer.printFile(undefined, st); // compose & print a whole source file
```

```typescript
// fits on one line → inline
factory.createCallExpression(id("foo"), undefined, [a, b]); // foo(a, b)

// exceeds printWidth → breaks
// foo(
//   argumentOne,
//   argumentTwo,
//   argumentThree,
// )
```

`printWidth` picks a layout, never a meaning. The break-time trailing comma is dropped where it would change the program (after the rest element of a destructuring assignment target, or after an argument-list hole), and it is written in both layouts where it is a value (the hole in `["a", "b", ,]`). JSX children stay on one line whenever a break would delete a whitespace-only child or trim the significant edge space off a text child, so the same tree renders the same text at every width.

### Comments

Attach leading / trailing comments with the legacy `ts.addSyntheticLeadingComment` family. The printer renders them in place — multi-line bodies re-indent with their node, so JSDoc on a nested member stays aligned.

```typescript
import factory, {
  SyntaxKind,
  TsPrinter,
  addSyntheticLeadingComment,
} from "@ttsc/factory";

const node = addSyntheticLeadingComment(
  factory.createTypeAliasDeclaration(
    undefined,
    "ID",
    undefined,
    factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
  ),
  SyntaxKind.MultiLineCommentTrivia,
  "*\n * The identifier.\n ",
  true,
);

new TsPrinter().print(node);
// /**
//  * The identifier.
//  */
// type ID = string;
```

Companion helpers: `addSyntheticTrailingComment`, `get`/`setSyntheticLeadingComments`, `get`/`setSyntheticTrailingComments`.

Synthetic comments are side-band data: they do not add properties to the node, so comments can be attached to frozen nodes. Compatible copies loaded in the same JavaScript realm share the versioned weak stores, including a CommonJS `require()` and an ES module `import()` of one installation or multiple installed copies. If a hardened realm prevents adding the registry to its global object before the first copy loads, each module falls back to private weak stores: comments and frozen nodes still work within that copy, but copies cannot exchange comments. A copy from an older release that predates this registry likewise cannot see comments written by a newer copy (or expose its private comments to one); upgrade every copy that exchanges nodes.

## Coverage

The factory and printer cover the constructs most used for code generation: identifiers, literals, the common expressions, types (keyword / reference / union / intersection / array / tuple / type-literal / function / operator / ...), statements, classes & interfaces, enums, functions & arrow functions, and import / export declarations. Coverage is easy to extend — add the node under `src/ast/`, a builder under `src/factory/`, and a `case` to the printer.

## License

MIT © [Jeongho Nam](https://github.com/samchon)
