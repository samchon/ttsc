import type { ModifierLike, Node, SourceFile, Statement } from "./ast";
import type { SynthesizedComment } from "./comments";
import {
  getSyntheticLeadingComments,
  getSyntheticTrailingComments,
} from "./comments";
import type { Doc } from "./internal/doc";
import {
  concat,
  group,
  hardline,
  ifBreak,
  indent,
  join,
  line,
  printDocToString,
  softline,
} from "./internal/doc";
import { SyntaxKind, tokenToString } from "./syntax";

/** Options for {@link TsPrinter}. */
export interface TsPrinterOptions {
  /** Maximum line width before groups break. Defaults to `80`. */
  printWidth?: number;
  /** Indentation unit. Defaults to two spaces. */
  indent?: string;
  /** New line sequence. Defaults to `"\n"` (LineFeed). */
  newLine?: string;
}

const escapeString = (text: string, singleQuote?: boolean): string => {
  const escaped: string = text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return singleQuote === true
    ? `'${escaped.replace(/'/g, "\\'")}'`
    : `"${escaped.replace(/"/g, '\\"')}"`;
};

/**
 * Printer turning {@link factory} produced AST nodes into TypeScript source
 * text.
 *
 * The printer is a width-aware pretty-printer: it builds a Prettier-style
 * document for the {@link Node} discriminated union and lays it out against
 * {@link TsPrinterOptions.printWidth}. Lists (arguments, parameters, generic
 * arguments, array / object members, ...) print on one line when they fit and
 * break onto indented lines — with trailing commas — when they do not. Every
 * `node.kind` narrows to its concrete type, so the walk is fully type-checked;
 * no `typescript` module is involved.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @example
 *   ```typescript
 *   import factory, { TsPrinter } from "@ttsc/factory";
 *
 *   const printer = new TsPrinter({ printWidth: 80, indent: "  " });
 *   printer.print(factory.createStringLiteral("hello")); // "hello"
 *   ```;
 */
export class TsPrinter {
  private readonly printWidth_: number;
  private readonly indent_: string;
  private readonly newLine_: string;

  public constructor(options: TsPrinterOptions = {}) {
    this.printWidth_ = options.printWidth ?? 80;
    this.indent_ = options.indent ?? "  ";
    this.newLine_ = options.newLine ?? "\n";
  }

  /** Print a single node (or a whole {@link SourceFile}) into source text. */
  public print(node: Node): string {
    return this.layout(this.emit(node));
  }

  /** Print multiple nodes, joining them with new lines. */
  public printNodes(nodes: readonly Node[]): string {
    return this.layout(
      join(
        hardline,
        nodes.map((n) => this.emit(n)),
      ),
    );
  }

  /**
   * Print an entire source file.
   *
   * @param sourceFile A {@link SourceFile}. When omitted, one is composed from
   *   the given `statements`.
   * @param statements Statements to compose a source file from when no
   *   `sourceFile` is provided.
   */
  public printFile(
    sourceFile?: SourceFile,
    statements: readonly Statement[] = [],
  ): string {
    const list: readonly Statement[] = sourceFile
      ? sourceFile.statements
      : statements;
    return (
      this.layout(
        join(
          hardline,
          list.map((s) => this.emit(s)),
        ),
      ) + this.newLine_
    );
  }

  /* ----------------------------------------------------------------------- */
  /*  INTERNAL                                                               */
  /* ----------------------------------------------------------------------- */
  private layout(doc: Doc): string {
    return printDocToString(doc, {
      printWidth: this.printWidth_,
      indent: this.indent_,
      newLine: this.newLine_,
    });
  }

  /** Comma-separated, width-aware delimited list (`(...)`, `[...]`, `<...>`). */
  private delim(
    open: string,
    items: Doc[],
    close: string,
    opts: {
      space?: boolean;
      trailingComma?: boolean;
      forceBreak?: boolean;
    } = {},
  ): Doc {
    if (items.length === 0) return open + close;
    const ln = opts.space ? line : softline;
    return group(
      concat([
        open,
        indent(concat([ln, join(concat([",", line]), items)])),
        opts.trailingComma ? ifBreak(",") : "",
        ln,
        close,
      ]),
      opts.forceBreak === true,
    );
  }

  /** Semicolon-separated member block (`{ a; b }`), e.g. interfaces. */
  private memberBlock(items: Doc[], forceBreak: boolean): Doc {
    if (items.length === 0) return "{}";
    return group(
      concat([
        "{",
        indent(concat([line, join(concat([";", line]), items)])),
        ifBreak(";"),
        line,
        "}",
      ]),
      forceBreak,
    );
  }

  /** Always-broken statement block (`{ ... }`). */
  private statementBlock(items: Doc[]): Doc {
    if (items.length === 0) return "{}";
    return concat([
      "{",
      indent(concat([hardline, join(hardline, items)])),
      hardline,
      "}",
    ]);
  }

  private typeArguments(args: readonly Node[] | undefined): Doc {
    return args && args.length
      ? this.delim(
          "<",
          args.map((a) => this.emit(a)),
          ">",
          {
            trailingComma: true,
          },
        )
      : "";
  }

  private params(params: readonly Node[]): Doc {
    return this.delim(
      "(",
      params.map((p) => this.emit(p)),
      ")",
      {
        trailingComma: true,
      },
    );
  }

  private modifiers(
    mods: readonly ModifierLike[] | undefined,
    decoratorsOnNewLine: boolean,
  ): Doc {
    if (!mods || mods.length === 0) return "";
    const decorators = mods.filter((m) => m.kind === "Decorator");
    const tokens = mods.filter((m) => m.kind !== "Decorator");
    const parts: Doc[] = [];
    const gap: Doc = decoratorsOnNewLine ? hardline : " ";
    if (decorators.length)
      parts.push(
        join(
          gap,
          decorators.map((d) => this.emit(d)),
        ),
        gap,
      );
    if (tokens.length)
      parts.push(
        join(
          " ",
          tokens.map((t) => this.emit(t)),
        ),
        " ",
      );
    return concat(parts);
  }

  private heritage(clauses: readonly Node[] | undefined): Doc {
    return clauses && clauses.length
      ? concat([
          " ",
          join(
            " ",
            clauses.map((c) => this.emit(c)),
          ),
        ])
      : "";
  }

  private optType(type: Node | undefined): Doc {
    return type ? concat([": ", this.emit(type)]) : "";
  }

  private optBody(body: Node | undefined): Doc {
    return body ? concat([" ", this.emit(body)]) : ";";
  }

  private emit(node: Node): Doc {
    const body: Doc = this.emitNode(node);
    const leading: SynthesizedComment[] | undefined =
      getSyntheticLeadingComments(node);
    const trailing: SynthesizedComment[] | undefined =
      getSyntheticTrailingComments(node);
    if (
      (leading === undefined || leading.length === 0) &&
      (trailing === undefined || trailing.length === 0)
    )
      return body;
    const parts: Doc[] = [];
    if (leading !== undefined)
      for (const comment of leading) parts.push(this.leadingComment(comment));
    parts.push(body);
    if (trailing !== undefined)
      for (const comment of trailing) parts.push(this.trailingComment(comment));
    return concat(parts);
  }

  /** Render a leading comment followed by its node separator. */
  private leadingComment(comment: SynthesizedComment): Doc {
    // a `//` comment must terminate the line; a `/* */` honours its own flag
    const newLine: boolean =
      comment.kind === SyntaxKind.SingleLineCommentTrivia ||
      comment.hasTrailingNewLine === true;
    return concat([this.commentBody(comment), newLine ? hardline : " "]);
  }

  /** Render a trailing comment preceded by its node separator. */
  private trailingComment(comment: SynthesizedComment): Doc {
    const newLine: boolean =
      comment.kind === SyntaxKind.SingleLineCommentTrivia ||
      comment.hasTrailingNewLine === true;
    return concat([
      comment.hasLeadingNewLine === true ? hardline : " ",
      this.commentBody(comment),
      newLine ? hardline : "",
    ]);
  }

  /** Render the delimited comment body, re-flowing embedded line breaks. */
  private commentBody(comment: SynthesizedComment): Doc {
    if (comment.kind === SyntaxKind.SingleLineCommentTrivia)
      return concat(["//", comment.text]);
    // re-emit embedded newlines as hardlines so each line re-indents in place
    return concat([
      "/*",
      join(hardline, comment.text.replace(/\r\n?/g, "\n").split("\n")),
      "*/",
    ]);
  }

  private emitNode(node: Node): Doc {
    switch (node.kind) {
      /* names & tokens */
      case "Identifier":
        return node.text;
      case "PrivateIdentifier":
        return node.text;
      case "QualifiedName":
        return concat([this.emit(node.left), ".", this.emit(node.right)]);
      case "Token":
        return tokenToString(node.token);
      case "Decorator":
        return concat(["@", this.emit(node.expression)]);

      /* literals */
      case "StringLiteral":
        return escapeString(node.text, node.singleQuote);
      case "NumericLiteral":
        return node.text;
      case "BigIntLiteral":
        return node.text;

      /* expressions */
      case "ArrayLiteralExpression":
        return this.delim(
          "[",
          node.elements.map((e) => this.emit(e)),
          "]",
          { trailingComma: true, forceBreak: node.multiLine === true },
        );
      case "ObjectLiteralExpression":
        return this.delim(
          "{",
          node.properties.map((p) => this.emit(p)),
          "}",
          {
            space: true,
            trailingComma: true,
            forceBreak: node.multiLine === true,
          },
        );
      case "PropertyAssignment":
        return concat([
          this.emit(node.name),
          ": ",
          this.emit(node.initializer),
        ]);
      case "ShorthandPropertyAssignment":
        return concat([
          this.emit(node.name),
          node.objectAssignmentInitializer
            ? concat([" = ", this.emit(node.objectAssignmentInitializer)])
            : "",
        ]);
      case "SpreadAssignment":
        return concat(["...", this.emit(node.expression)]);
      case "PropertyAccessExpression":
        return concat([this.emit(node.expression), ".", this.emit(node.name)]);
      case "ElementAccessExpression":
        return concat([
          this.emit(node.expression),
          "[",
          this.emit(node.argumentExpression),
          "]",
        ]);
      case "CallExpression":
        return concat([
          this.emit(node.expression),
          this.typeArguments(node.typeArguments),
          this.params(node.arguments),
        ]);
      case "NewExpression":
        return concat([
          "new ",
          this.emit(node.expression),
          this.typeArguments(node.typeArguments),
          this.params(node.arguments ?? []),
        ]);
      case "ParenthesizedExpression":
        return concat(["(", this.emit(node.expression), ")"]);
      case "BinaryExpression":
        return group(
          concat([
            this.emit(node.left),
            " ",
            tokenToString(node.operator),
            indent(concat([line, this.emit(node.right)])),
          ]),
        );
      case "PrefixUnaryExpression":
        return concat([tokenToString(node.operator), this.emit(node.operand)]);
      case "PostfixUnaryExpression":
        return concat([this.emit(node.operand), tokenToString(node.operator)]);
      case "ConditionalExpression":
        return group(
          concat([
            this.emit(node.condition),
            indent(
              concat([
                line,
                "? ",
                this.emit(node.whenTrue),
                line,
                ": ",
                this.emit(node.whenFalse),
              ]),
            ),
          ]),
        );
      case "ArrowFunction":
        return concat([
          this.modifiers(node.modifiers, false),
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          this.optType(node.type),
          " => ",
          this.emit(node.body),
        ]);
      case "FunctionExpression":
        return concat([
          this.modifiers(node.modifiers, false),
          "function",
          node.asteriskToken ? "*" : "",
          node.name ? concat([" ", this.emit(node.name)]) : " ",
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          this.optType(node.type),
          " ",
          this.emit(node.body),
        ]);
      case "AsExpression":
        return concat([
          this.emit(node.expression),
          " as ",
          this.emit(node.type),
        ]);
      case "SatisfiesExpression":
        return concat([
          this.emit(node.expression),
          " satisfies ",
          this.emit(node.type),
        ]);
      case "NonNullExpression":
        return concat([this.emit(node.expression), "!"]);
      case "SpreadElement":
        return concat(["...", this.emit(node.expression)]);
      case "AwaitExpression":
        return concat(["await ", this.emit(node.expression)]);
      case "TypeOfExpression":
        return concat(["typeof ", this.emit(node.expression)]);

      /* types */
      case "KeywordTypeNode":
        return tokenToString(node.keyword);
      case "TypeReferenceNode":
        return concat([
          this.emit(node.typeName),
          this.typeArguments(node.typeArguments),
        ]);
      case "ArrayTypeNode":
        return concat([this.emit(node.elementType), "[]"]);
      case "UnionTypeNode":
        return this.binaryType(
          "|",
          node.types.map((t) => this.emit(t)),
        );
      case "IntersectionTypeNode":
        return this.binaryType(
          "&",
          node.types.map((t) => this.emit(t)),
        );
      case "LiteralTypeNode":
        return this.emit(node.literal);
      case "TypeLiteralNode":
        return this.memberBlock(
          node.members.map((m) => this.emit(m)),
          false,
        );
      case "FunctionTypeNode":
        return concat([
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          " => ",
          this.emit(node.type),
        ]);
      case "TupleTypeNode":
        return this.delim(
          "[",
          node.elements.map((e) => this.emit(e)),
          "]",
          {
            trailingComma: true,
          },
        );
      case "ParenthesizedTypeNode":
        return concat(["(", this.emit(node.type), ")"]);
      case "TypeOperatorNode":
        return concat([
          tokenToString(node.operator),
          " ",
          this.emit(node.type),
        ]);
      case "IndexedAccessTypeNode":
        return concat([
          this.emit(node.objectType),
          "[",
          this.emit(node.indexType),
          "]",
        ]);
      case "TypeQueryNode":
        return concat(["typeof ", this.emit(node.exprName)]);
      case "ExpressionWithTypeArguments":
        return concat([
          this.emit(node.expression),
          this.typeArguments(node.typeArguments),
        ]);
      case "PropertySignature":
        return concat([
          this.modifiers(node.modifiers, false),
          this.emit(node.name),
          node.questionToken ? "?" : "",
          this.optType(node.type),
        ]);
      case "IndexSignature":
        return concat([
          this.modifiers(node.modifiers, false),
          "[",
          join(
            ", ",
            node.parameters.map((p) => this.emit(p)),
          ),
          "]: ",
          this.emit(node.type),
        ]);
      case "MethodSignature":
        return concat([
          this.modifiers(node.modifiers, false),
          this.emit(node.name),
          node.questionToken ? "?" : "",
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          this.optType(node.type),
        ]);
      case "TypeParameterDeclaration":
        return concat([
          this.modifiers(node.modifiers, false),
          this.emit(node.name),
          node.constraint
            ? concat([" extends ", this.emit(node.constraint)])
            : "",
          node.default ? concat([" = ", this.emit(node.default)]) : "",
        ]);

      /* support */
      case "ParameterDeclaration":
        return concat([
          this.modifiers(node.modifiers, false),
          node.dotDotDotToken ? "..." : "",
          this.emit(node.name),
          node.questionToken ? "?" : "",
          this.optType(node.type),
          node.initializer ? concat([" = ", this.emit(node.initializer)]) : "",
        ]);
      case "HeritageClause":
        return concat([
          tokenToString(node.token),
          " ",
          join(
            ", ",
            node.types.map((t) => this.emit(t)),
          ),
        ]);

      /* statements */
      case "VariableStatement":
        return concat([
          this.modifiers(node.modifiers, false),
          this.emit(node.declarationList),
          ";",
        ]);
      case "VariableDeclarationList": {
        const keyword: string =
          node.flags === 2 ? "const" : node.flags === 1 ? "let" : "var";
        return concat([
          keyword,
          " ",
          join(
            ", ",
            node.declarations.map((d) => this.emit(d)),
          ),
        ]);
      }
      case "VariableDeclaration":
        return concat([
          this.emit(node.name),
          node.exclamationToken ? "!" : "",
          this.optType(node.type),
          node.initializer ? concat([" = ", this.emit(node.initializer)]) : "",
        ]);
      case "ExpressionStatement":
        return concat([this.emit(node.expression), ";"]);
      case "ReturnStatement":
        return node.expression
          ? concat(["return ", this.emit(node.expression), ";"])
          : "return;";
      case "ThrowStatement":
        return concat(["throw ", this.emit(node.expression), ";"]);
      case "IfStatement":
        return concat([
          "if (",
          this.emit(node.expression),
          ") ",
          this.emit(node.thenStatement),
          node.elseStatement
            ? concat([" else ", this.emit(node.elseStatement)])
            : "",
        ]);
      case "Block":
        return this.statementBlock(node.statements.map((s) => this.emit(s)));

      /* declarations */
      case "FunctionDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          "function",
          node.asteriskToken ? "*" : "",
          " ",
          node.name ? this.emit(node.name) : "",
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          this.optType(node.type),
          this.optBody(node.body),
        ]);
      case "ClassDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          "class",
          node.name ? concat([" ", this.emit(node.name)]) : "",
          this.typeArguments(node.typeParameters),
          this.heritage(node.heritageClauses),
          " ",
          this.statementBlock(node.members.map((m) => this.emit(m))),
        ]);
      case "PropertyDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          this.emit(node.name),
          node.questionOrExclamationToken
            ? this.emit(node.questionOrExclamationToken)
            : "",
          this.optType(node.type),
          node.initializer ? concat([" = ", this.emit(node.initializer)]) : "",
          ";",
        ]);
      case "MethodDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          node.asteriskToken ? "*" : "",
          this.emit(node.name),
          node.questionToken ? "?" : "",
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          this.optType(node.type),
          this.optBody(node.body),
        ]);
      case "ConstructorDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          "constructor",
          this.params(node.parameters),
          this.optBody(node.body),
        ]);
      case "GetAccessorDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          "get ",
          this.emit(node.name),
          this.params(node.parameters),
          this.optType(node.type),
          this.optBody(node.body),
        ]);
      case "SetAccessorDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          "set ",
          this.emit(node.name),
          this.params(node.parameters),
          this.optBody(node.body),
        ]);
      case "InterfaceDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          "interface ",
          this.emit(node.name),
          this.typeArguments(node.typeParameters),
          this.heritage(node.heritageClauses),
          " ",
          this.memberBlock(
            node.members.map((m) => this.emit(m)),
            true,
          ),
        ]);
      case "TypeAliasDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          "type ",
          this.emit(node.name),
          this.typeArguments(node.typeParameters),
          " = ",
          this.emit(node.type),
          ";",
        ]);
      case "EnumDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          "enum ",
          this.emit(node.name),
          " ",
          node.members.length === 0
            ? "{}"
            : concat([
                "{",
                indent(
                  concat([
                    hardline,
                    join(
                      concat([",", hardline]),
                      node.members.map((m) => this.emit(m)),
                    ),
                    ",",
                  ]),
                ),
                hardline,
                "}",
              ]),
        ]);
      case "EnumMember":
        return concat([
          this.emit(node.name),
          node.initializer ? concat([" = ", this.emit(node.initializer)]) : "",
        ]);

      /* imports & exports */
      case "ImportDeclaration":
        return concat([
          this.modifiers(node.modifiers, false),
          "import ",
          node.importClause
            ? concat([this.emit(node.importClause), " from "])
            : "",
          this.emit(node.moduleSpecifier),
          ";",
        ]);
      case "ImportClause": {
        const named: Doc[] = [];
        if (node.name) named.push(this.emit(node.name));
        if (node.namedBindings) named.push(this.emit(node.namedBindings));
        return concat([node.isTypeOnly ? "type " : "", join(", ", named)]);
      }
      case "NamedImports":
        return this.delim(
          "{",
          node.elements.map((e) => this.emit(e)),
          "}",
          { space: true, trailingComma: true },
        );
      case "ImportSpecifier":
        return concat([
          node.isTypeOnly ? "type " : "",
          node.propertyName
            ? concat([this.emit(node.propertyName), " as "])
            : "",
          this.emit(node.name),
        ]);
      case "NamespaceImport":
        return concat(["* as ", this.emit(node.name)]);
      case "ExportDeclaration":
        return concat([
          this.modifiers(node.modifiers, false),
          "export ",
          node.isTypeOnly ? "type " : "",
          node.exportClause ? this.emit(node.exportClause) : "*",
          node.moduleSpecifier
            ? concat([" from ", this.emit(node.moduleSpecifier)])
            : "",
          ";",
        ]);
      case "NamedExports":
        return this.delim(
          "{",
          node.elements.map((e) => this.emit(e)),
          "}",
          { space: true, trailingComma: true },
        );
      case "ExportSpecifier":
        return concat([
          node.isTypeOnly ? "type " : "",
          node.propertyName
            ? concat([this.emit(node.propertyName), " as "])
            : "",
          this.emit(node.name),
        ]);
      case "ExportAssignment":
        return concat([
          this.modifiers(node.modifiers, false),
          node.isExportEquals ? "export = " : "export default ",
          this.emit(node.expression),
          ";",
        ]);

      /* source file */
      case "SourceFile":
        return concat([
          join(
            hardline,
            node.statements.map((s) => this.emit(s)),
          ),
          hardline,
        ]);

      /* loops & flow */
      case "ForStatement":
        return concat([
          "for (",
          node.initializer ? this.emit(node.initializer) : "",
          "; ",
          node.condition ? this.emit(node.condition) : "",
          "; ",
          node.incrementor ? this.emit(node.incrementor) : "",
          ") ",
          this.emit(node.statement),
        ]);
      case "ForInStatement":
        return concat([
          "for (",
          this.emit(node.initializer),
          " in ",
          this.emit(node.expression),
          ") ",
          this.emit(node.statement),
        ]);
      case "ForOfStatement":
        return concat([
          "for ",
          node.awaitModifier ? "await " : "",
          "(",
          this.emit(node.initializer),
          " of ",
          this.emit(node.expression),
          ") ",
          this.emit(node.statement),
        ]);
      case "WhileStatement":
        return concat([
          "while (",
          this.emit(node.expression),
          ") ",
          this.emit(node.statement),
        ]);
      case "DoStatement":
        return concat([
          "do ",
          this.emit(node.statement),
          " while (",
          this.emit(node.expression),
          ");",
        ]);
      case "SwitchStatement":
        return concat([
          "switch (",
          this.emit(node.expression),
          ") ",
          this.emit(node.caseBlock),
        ]);
      case "CaseBlock":
        return node.clauses.length === 0
          ? "{}"
          : concat([
              "{",
              indent(
                concat([
                  hardline,
                  join(
                    hardline,
                    node.clauses.map((c) => this.emit(c)),
                  ),
                ]),
              ),
              hardline,
              "}",
            ]);
      case "CaseClause":
        return concat([
          "case ",
          this.emit(node.expression),
          ":",
          node.statements.length
            ? indent(
                concat([
                  hardline,
                  join(
                    hardline,
                    node.statements.map((s) => this.emit(s)),
                  ),
                ]),
              )
            : "",
        ]);
      case "DefaultClause":
        return concat([
          "default:",
          node.statements.length
            ? indent(
                concat([
                  hardline,
                  join(
                    hardline,
                    node.statements.map((s) => this.emit(s)),
                  ),
                ]),
              )
            : "",
        ]);
      case "BreakStatement":
        return node.label
          ? concat(["break ", this.emit(node.label), ";"])
          : "break;";
      case "ContinueStatement":
        return node.label
          ? concat(["continue ", this.emit(node.label), ";"])
          : "continue;";
      case "TryStatement":
        return concat([
          "try ",
          this.emit(node.tryBlock),
          node.catchClause ? concat([" ", this.emit(node.catchClause)]) : "",
          node.finallyBlock
            ? concat([" finally ", this.emit(node.finallyBlock)])
            : "",
        ]);
      case "CatchClause":
        return node.variableDeclaration
          ? concat([
              "catch (",
              this.emit(node.variableDeclaration),
              ") ",
              this.emit(node.block),
            ])
          : concat(["catch ", this.emit(node.block)]);
      case "LabeledStatement":
        return concat([this.emit(node.label), ": ", this.emit(node.statement)]);
      case "WithStatement":
        return concat([
          "with (",
          this.emit(node.expression),
          ") ",
          this.emit(node.statement),
        ]);
      case "DebuggerStatement":
        return "debugger;";
      case "EmptyStatement":
        return ";";

      /* modules & namespaces */
      case "ModuleDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          node.name.kind === "StringLiteral" ? "module " : "namespace ",
          this.emit(node.name),
          node.body ? concat([" ", this.emit(node.body)]) : ";",
        ]);
      case "ModuleBlock":
        return this.statementBlock(node.statements.map((s) => this.emit(s)));
      case "ClassStaticBlockDeclaration":
        return concat(["static ", this.emit(node.body)]);
      case "ImportEqualsDeclaration":
        return concat([
          this.modifiers(node.modifiers, false),
          "import ",
          node.isTypeOnly ? "type " : "",
          this.emit(node.name),
          " = ",
          this.emit(node.moduleReference),
          ";",
        ]);
      case "ExternalModuleReference":
        return concat(["require(", this.emit(node.expression), ")"]);
      case "NamespaceExportDeclaration":
        return concat(["export as namespace ", this.emit(node.name), ";"]);
      case "SemicolonClassElement":
        return ";";
      case "NamespaceExport":
        return concat(["* as ", this.emit(node.name)]);

      /* advanced types */
      case "ThisTypeNode":
        return "this";
      case "ConstructorTypeNode":
        return concat([
          this.modifiers(node.modifiers, false),
          "new ",
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          " => ",
          this.emit(node.type),
        ]);
      case "TypePredicateNode":
        return concat([
          node.assertsModifier ? "asserts " : "",
          this.emit(node.parameterName),
          node.type ? concat([" is ", this.emit(node.type)]) : "",
        ]);
      case "ConditionalTypeNode":
        return concat([
          this.emit(node.checkType),
          " extends ",
          this.emit(node.extendsType),
          " ? ",
          this.emit(node.trueType),
          " : ",
          this.emit(node.falseType),
        ]);
      case "InferTypeNode":
        return concat(["infer ", this.emit(node.typeParameter)]);
      case "MappedTypeNode": {
        const ro = node.readonlyToken
          ? tokenToString(node.readonlyToken.token) === "readonly"
            ? "readonly "
            : `${tokenToString(node.readonlyToken.token)}readonly `
          : "";
        const q = node.questionToken
          ? tokenToString(node.questionToken.token) === "?"
            ? "?"
            : `${tokenToString(node.questionToken.token)}?`
          : "";
        return concat([
          "{ ",
          ro,
          "[",
          this.emit(node.typeParameter.name),
          " in ",
          node.typeParameter.constraint
            ? this.emit(node.typeParameter.constraint)
            : "",
          node.nameType ? concat([" as ", this.emit(node.nameType)]) : "",
          "]",
          q,
          node.type ? concat([": ", this.emit(node.type)]) : "",
          " }",
        ]);
      }
      case "TemplateLiteralType":
        return concat([
          this.emit(node.head),
          concat(node.templateSpans.map((s) => this.emit(s))),
        ]);
      case "TemplateLiteralTypeSpan":
        return concat([this.emit(node.type), this.emit(node.literal)]);
      case "NamedTupleMember":
        return concat([
          node.dotDotDotToken ? "..." : "",
          this.emit(node.name),
          node.questionToken ? "?" : "",
          ": ",
          this.emit(node.type),
        ]);
      case "OptionalTypeNode":
        return concat([this.emit(node.type), "?"]);
      case "RestTypeNode":
        return concat(["...", this.emit(node.type)]);
      case "ImportTypeNode":
        return concat([
          node.isTypeOf ? "typeof " : "",
          "import(",
          this.emit(node.argument),
          ")",
          node.qualifier ? concat([".", this.emit(node.qualifier)]) : "",
          this.typeArguments(node.typeArguments),
        ]);
      case "CallSignature":
        return concat([
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          this.optType(node.type),
        ]);
      case "ConstructSignature":
        return concat([
          "new ",
          this.typeArguments(node.typeParameters),
          this.params(node.parameters),
          this.optType(node.type),
        ]);

      /* template literals */
      case "TemplateHead":
        return concat(["`", node.text, "${"]);
      case "TemplateMiddle":
        return concat(["}", node.text, "${"]);
      case "TemplateTail":
        return concat(["}", node.text, "`"]);
      case "NoSubstitutionTemplateLiteral":
        return concat(["`", node.text, "`"]);

      /* template & misc expressions */
      case "TemplateExpression":
        return concat([
          this.emit(node.head),
          concat(node.templateSpans.map((s) => this.emit(s))),
        ]);
      case "TemplateSpan":
        return concat([this.emit(node.expression), this.emit(node.literal)]);
      case "TaggedTemplateExpression":
        return concat([
          this.emit(node.tag),
          this.typeArguments(node.typeArguments),
          this.emit(node.template),
        ]);
      case "YieldExpression":
        return concat([
          "yield",
          node.asteriskToken ? "*" : "",
          node.expression ? concat([" ", this.emit(node.expression)]) : "",
        ]);
      case "DeleteExpression":
        return concat(["delete ", this.emit(node.expression)]);
      case "VoidExpression":
        return concat(["void ", this.emit(node.expression)]);
      case "RegularExpressionLiteral":
        return node.text;
      case "ClassExpression":
        return concat([
          this.modifiers(node.modifiers, true),
          "class",
          node.name ? concat([" ", this.emit(node.name)]) : "",
          this.typeArguments(node.typeParameters),
          this.heritage(node.heritageClauses),
          " ",
          this.statementBlock(node.members.map((m) => this.emit(m))),
        ]);
      case "MetaProperty":
        return concat([
          tokenToString(node.keywordToken),
          ".",
          this.emit(node.name),
        ]);
      case "CommaListExpression":
        return join(
          ", ",
          node.elements.map((e) => this.emit(e)),
        );
      case "ComputedPropertyName":
        return concat(["[", this.emit(node.expression), "]"]);
      case "OmittedExpression":
        return "";
      case "BindingElement":
        return concat([
          node.dotDotDotToken ? "..." : "",
          node.propertyName ? concat([this.emit(node.propertyName), ": "]) : "",
          this.emit(node.name),
          node.initializer ? concat([" = ", this.emit(node.initializer)]) : "",
        ]);
      case "ObjectBindingPattern":
        return this.delim(
          "{",
          node.elements.map((e) => this.emit(e)),
          "}",
          { space: true, trailingComma: true },
        );
      case "ArrayBindingPattern":
        return this.delim(
          "[",
          node.elements.map((e) => this.emit(e)),
          "]",
          { trailingComma: true },
        );
      case "TypeAssertion":
        return concat([
          "<",
          this.emit(node.type),
          ">",
          this.emit(node.expression),
        ]);
      case "PropertyAccessChain":
        return concat([
          this.emit(node.expression),
          node.questionDotToken ? "?." : ".",
          this.emit(node.name),
        ]);
      case "ElementAccessChain":
        return concat([
          this.emit(node.expression),
          node.questionDotToken ? "?." : "",
          "[",
          this.emit(node.argumentExpression),
          "]",
        ]);
      case "CallChain":
        return concat([
          this.emit(node.expression),
          node.questionDotToken ? "?." : "",
          this.typeArguments(node.typeArguments),
          this.params(node.arguments),
        ]);
      case "NonNullChain":
        return concat([this.emit(node.expression), "!"]);

      default:
        return this.unsupported(node);
    }
  }

  /** Width-aware `|` / `&` type list with leading-operator breaks. */
  private binaryType(operator: string, parts: Doc[]): Doc {
    if (parts.length === 1) return parts[0]!;
    return group(
      indent(
        concat([
          ifBreak(concat([line, operator, " "])),
          join(concat([line, operator, " "]), parts),
        ]),
      ),
    );
  }

  private unsupported(node: never): never {
    throw new Error(
      `@ttsc/factory: TsPrinter cannot print node of kind "${
        (node as Node).kind
      }".`,
    );
  }
}
