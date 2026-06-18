import type {
  Block,
  Expression,
  ModifierLike,
  Node,
  SourceFile,
  Statement,
  TypeNode,
} from "./ast";
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
import { NodeFlags, SyntaxKind } from "./syntax";

/**
 * Printer turning {@link factory} produced AST nodes into TypeScript source
 * text.
 *
 * The printer is a width-aware pretty-printer: it builds a Prettier-style
 * document for the {@link Node} discriminated union and lays it out against
 * {@link TsPrinter.IProps.printWidth}. Lists (arguments, parameters, generic
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

  public constructor(options: TsPrinter.IProps = {}) {
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

  /**
   * Semicolon-separated member block (`{ a; b }`), e.g. interfaces.
   *
   * A bare {@link import("./ast").Identifier} member acts as a blank-line spacer
   * (the legacy `createIdentifier("\n")` codegen idiom): it inserts an empty
   * line between members and carries no `;` terminator, matching the legacy
   * printer.
   */
  private memberBlock(members: readonly Node[], forceBreak: boolean): Doc {
    const inner: Doc[] = [];
    let first: boolean = true;
    let blank: boolean = false;
    for (const member of members) {
      if (member.kind === "Identifier") {
        blank = true;
        continue;
      }
      if (!first) inner.push(";", line);
      if (blank) {
        inner.push(hardline);
        blank = false;
      }
      inner.push(this.emit(member));
      first = false;
    }
    if (inner.length === 0) return "{}";
    return group(
      concat([
        "{",
        indent(concat([line, concat(inner)])),
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
    // type-argument / type-parameter lists disallow a trailing comma (TS1009)
    return args && args.length
      ? this.delim(
          "<",
          args.map((a) => this.emit(a)),
          ">",
          {
            trailingComma: false,
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

  private args(args: readonly Expression[]): Doc {
    return this.delim(
      "(",
      args.map((a) => this.expressionForDisallowedComma(a)),
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
        return node.token;
      case "Decorator":
        return concat(["@", this.leftSideExpression(node.expression)]);

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
          node.elements.map((e) => this.expressionForDisallowedComma(e)),
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
          this.expressionForDisallowedComma(node.initializer),
        ]);
      case "ShorthandPropertyAssignment":
        return concat([
          this.emit(node.name),
          node.objectAssignmentInitializer
            ? concat([
                " = ",
                this.expressionForDisallowedComma(
                  node.objectAssignmentInitializer,
                ),
              ])
            : "",
        ]);
      case "SpreadAssignment":
        return concat([
          "...",
          this.expressionForDisallowedComma(node.expression),
        ]);
      case "PropertyAccessExpression":
        return concat([
          this.leftSideExpression(node.expression),
          ".",
          this.emit(node.name),
        ]);
      case "ElementAccessExpression":
        return concat([
          this.leftSideExpression(node.expression),
          "[",
          this.expressionForDisallowedComma(node.argumentExpression),
          "]",
        ]);
      case "CallExpression":
        return concat([
          this.leftSideExpression(node.expression),
          this.typeArguments(node.typeArguments),
          this.args(node.arguments),
        ]);
      case "NewExpression":
        return concat([
          "new ",
          this.newExpressionTarget(node.expression),
          this.typeArguments(node.typeArguments),
          this.args(node.arguments ?? []),
        ]);
      case "ParenthesizedExpression":
        return concat(["(", this.emit(node.expression), ")"]);
      case "BinaryExpression":
        return group(
          concat([
            this.binaryOperand(node.operator, node.left, true),
            " ",
            node.operator,
            indent(
              concat([
                line,
                this.binaryOperand(node.operator, node.right, false, node.left),
              ]),
            ),
          ]),
        );
      case "PrefixUnaryExpression":
        return concat([
          node.operator,
          this.prefixUnaryOperand(node.operand, node.operator),
        ]);
      case "PostfixUnaryExpression":
        return concat([this.postfixUnaryOperand(node.operand), node.operator]);
      case "ConditionalExpression":
        return group(
          concat([
            this.conditionalCondition(node.condition),
            indent(
              concat([
                line,
                "? ",
                this.conditionalBranch(node.whenTrue),
                line,
                ": ",
                this.conditionalBranch(node.whenFalse),
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
          this.arrowFunctionBody(node.body),
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
          this.assertionExpressionOperand(node.expression),
          " as ",
          this.emit(node.type),
        ]);
      case "SatisfiesExpression":
        return concat([
          this.assertionExpressionOperand(node.expression),
          " satisfies ",
          this.emit(node.type),
        ]);
      case "NonNullExpression":
        return concat([this.leftSideExpression(node.expression), "!"]);
      case "SpreadElement":
        return concat([
          "...",
          this.expressionForDisallowedComma(node.expression),
        ]);
      case "AwaitExpression":
        return concat(["await ", this.prefixUnaryOperand(node.expression)]);
      case "TypeOfExpression":
        return concat(["typeof ", this.prefixUnaryOperand(node.expression)]);

      /* types */
      case "KeywordTypeNode":
        return node.keyword;
      case "TypeReferenceNode":
        return concat([
          this.emit(node.typeName),
          this.typeArguments(node.typeArguments),
        ]);
      case "ArrayTypeNode":
        return concat([this.postfixTypeOperand(node.elementType), "[]"]);
      case "UnionTypeNode":
        return this.binaryType("|", node.types);
      case "IntersectionTypeNode":
        return this.binaryType("&", node.types);
      case "LiteralTypeNode":
        return this.emit(node.literal);
      case "TypeLiteralNode":
        return this.memberBlock(node.members, false);
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
          node.operator,
          " ",
          this.typeOperatorOperand(node.type, node.operator),
        ]);
      case "IndexedAccessTypeNode":
        return concat([
          this.postfixTypeOperand(node.objectType),
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
          node.initializer
            ? concat([
                " = ",
                this.expressionForDisallowedComma(node.initializer),
              ])
            : "",
        ]);
      case "HeritageClause":
        return concat([
          node.token,
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
          node.flags === NodeFlags.Const
            ? "const"
            : node.flags === NodeFlags.Let
              ? "let"
              : "var";
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
          node.initializer
            ? concat([
                " = ",
                this.expressionForDisallowedComma(node.initializer),
              ])
            : "",
        ]);
      case "ExpressionStatement":
        return concat([
          this.expressionStatementExpression(node.expression),
          ";",
        ]);
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
          node.initializer
            ? concat([
                " = ",
                this.expressionForDisallowedComma(node.initializer),
              ])
            : "",
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
          this.memberBlock(node.members, true),
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
          node.initializer
            ? concat([
                " = ",
                this.expressionForDisallowedComma(node.initializer),
              ])
            : "",
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
          this.exportAssignmentExpression(
            node.expression,
            node.isExportEquals === true,
          ),
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
          this.conditionalTypeCheckOperand(node.checkType),
          " extends ",
          this.conditionalTypeExtendsOperand(node.extendsType),
          " ? ",
          this.emit(node.trueType),
          " : ",
          this.emit(node.falseType),
        ]);
      case "InferTypeNode":
        return concat(["infer ", this.emit(node.typeParameter)]);
      case "MappedTypeNode": {
        const ro = node.readonlyToken
          ? node.readonlyToken.token === "readonly"
            ? "readonly "
            : `${node.readonlyToken.token}readonly `
          : "";
        const q = node.questionToken
          ? node.questionToken.token === "?"
            ? "?"
            : `${node.questionToken.token}?`
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
        return concat([this.postfixTypeOperand(node.type), "?"]);
      case "RestTypeNode":
        return concat(["...", this.postfixTypeOperand(node.type)]);
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
        return concat([
          this.expressionForDisallowedComma(node.expression),
          this.emit(node.literal),
        ]);
      case "TaggedTemplateExpression":
        return concat([
          this.leftSideExpression(node.tag),
          this.typeArguments(node.typeArguments),
          this.emit(node.template),
        ]);
      case "YieldExpression":
        return concat([
          "yield",
          node.asteriskToken ? "*" : "",
          node.expression
            ? concat([" ", this.expressionForDisallowedComma(node.expression)])
            : "",
        ]);
      case "DeleteExpression":
        return concat(["delete ", this.prefixUnaryOperand(node.expression)]);
      case "VoidExpression":
        return concat(["void ", this.prefixUnaryOperand(node.expression)]);
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
        return concat([node.keywordToken, ".", this.emit(node.name)]);
      case "CommaListExpression":
        return join(
          ", ",
          node.elements.map((e) => this.emit(e)),
        );
      case "ComputedPropertyName":
        return concat([
          "[",
          this.expressionForDisallowedComma(node.expression),
          "]",
        ]);
      case "OmittedExpression":
        return "";
      case "BindingElement":
        return concat([
          node.dotDotDotToken ? "..." : "",
          node.propertyName ? concat([this.emit(node.propertyName), ": "]) : "",
          this.emit(node.name),
          node.initializer
            ? concat([
                " = ",
                this.expressionForDisallowedComma(node.initializer),
              ])
            : "",
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
          this.prefixUnaryOperand(node.expression),
        ]);
      case "PropertyAccessChain":
        return concat([
          this.leftSideExpression(node.expression),
          node.questionDotToken ? "?." : ".",
          this.emit(node.name),
        ]);
      case "ElementAccessChain":
        return concat([
          this.leftSideExpression(node.expression),
          node.questionDotToken ? "?." : "",
          "[",
          this.expressionForDisallowedComma(node.argumentExpression),
          "]",
        ]);
      case "CallChain":
        return concat([
          this.leftSideExpression(node.expression),
          node.questionDotToken ? "?." : "",
          this.typeArguments(node.typeArguments),
          this.args(node.arguments),
        ]);
      case "NonNullChain":
        return concat([this.leftSideExpression(node.expression), "!"]);

      /* jsx */
      case "JsxElement":
        return group(
          concat([
            this.emit(node.openingElement),
            indent(
              concat(
                node.children.map((c) => concat([softline, this.emit(c)])),
              ),
            ),
            softline,
            this.emit(node.closingElement),
          ]),
        );
      case "JsxSelfClosingElement":
        return concat([
          "<",
          this.emit(node.tagName),
          this.typeArguments(node.typeArguments),
          this.emit(node.attributes),
          " />",
        ]);
      case "JsxOpeningElement":
        return concat([
          "<",
          this.emit(node.tagName),
          this.typeArguments(node.typeArguments),
          this.emit(node.attributes),
          ">",
        ]);
      case "JsxClosingElement":
        return concat(["</", this.emit(node.tagName), ">"]);
      case "JsxFragment":
        return group(
          concat([
            this.emit(node.openingFragment),
            indent(
              concat(
                node.children.map((c) => concat([softline, this.emit(c)])),
              ),
            ),
            softline,
            this.emit(node.closingFragment),
          ]),
        );
      case "JsxOpeningFragment":
        return "<>";
      case "JsxClosingFragment":
        return "</>";
      case "JsxText":
        return node.text;
      case "JsxAttribute":
        return node.initializer === undefined
          ? this.emit(node.name)
          : concat([this.emit(node.name), "=", this.emit(node.initializer)]);
      case "JsxAttributes":
        return node.properties.length === 0
          ? ""
          : concat(node.properties.map((p) => concat([" ", this.emit(p)])));
      case "JsxSpreadAttribute":
        return concat(["{...", this.emit(node.expression), "}"]);
      case "JsxExpression":
        return concat([
          "{",
          node.dotDotDotToken ? "..." : "",
          node.expression ? this.emit(node.expression) : "",
          "}",
        ]);
      case "JsxNamespacedName":
        return concat([this.emit(node.namespace), ":", this.emit(node.name)]);

      /* synthetic / emit-internal */
      case "Bundle":
        return join(
          hardline,
          node.sourceFiles.map((s) => this.emit(s)),
        );
      case "PartiallyEmittedExpression":
        return this.emit(node.expression);
      case "ImportAttribute":
        return concat([this.emit(node.name), ": ", this.emit(node.value)]);
      case "ImportAttributes":
        return node.elements.length === 0
          ? concat([node.token, " {}"])
          : concat([
              node.token,
              " { ",
              join(
                ", ",
                node.elements.map((e) => this.emit(e)),
              ),
              " }",
            ]);
      case "NotEmittedStatement":
      case "NotEmittedTypeElement":
        return "";

      /* jsdoc — types */
      case "JSDocAllType":
        return "*";
      case "JSDocUnknownType":
        return "?";
      case "JSDocNonNullableType":
        return node.postfix
          ? concat([this.emit(node.type), "!"])
          : concat(["!", this.emit(node.type)]);
      case "JSDocNullableType":
        return node.postfix
          ? concat([this.emit(node.type), "?"])
          : concat(["?", this.emit(node.type)]);
      case "JSDocOptionalType":
        return concat([this.emit(node.type), "="]);
      case "JSDocVariadicType":
        return concat(["...", this.emit(node.type)]);
      case "JSDocNamepathType":
        return this.emit(node.type);
      case "JSDocFunctionType":
        return concat([
          "function(",
          join(
            ", ",
            node.parameters.map((p) => this.emit(p)),
          ),
          ")",
          node.type ? concat([": ", this.emit(node.type)]) : "",
        ]);
      case "JSDocTypeExpression":
        return concat(["{", this.emit(node.type), "}"]);
      case "JSDocNameReference":
        return this.emit(node.name);
      case "JSDocMemberName":
        return concat([this.emit(node.left), "#", this.emit(node.right)]);
      case "JSDocLink":
        return concat([
          "{@link ",
          node.name ? this.emit(node.name) : "",
          node.text,
          "}",
        ]);
      case "JSDocLinkCode":
        return concat([
          "{@linkcode ",
          node.name ? this.emit(node.name) : "",
          node.text,
          "}",
        ]);
      case "JSDocLinkPlain":
        return concat([
          "{@linkplain ",
          node.name ? this.emit(node.name) : "",
          node.text,
          "}",
        ]);
      case "JSDocText":
        return node.text;
      case "JSDocTypeLiteral":
        return concat([
          join(
            hardline,
            (node.jsDocPropertyTags ?? []).map((t) => this.emit(t)),
          ),
          node.isArrayType ? "[]" : "",
        ]);
      case "JSDocSignature":
        return join(
          hardline,
          [
            ...(node.typeParameters ?? []),
            ...node.parameters,
            ...(node.type ? [node.type] : []),
          ].map((t) => this.emit(t)),
        );
      case "JSDoc": {
        const body: Doc =
          node.comment === undefined
            ? ""
            : typeof node.comment === "string"
              ? node.comment
              : concat(node.comment.map((c) => this.emit(c)));
        const lines: Doc[] = [concat([" * ", body])];
        for (const tag of node.tags ?? [])
          lines.push(concat([" * ", this.emit(tag)]));
        return concat([
          "/**",
          hardline,
          join(hardline, lines),
          hardline,
          " */",
        ]);
      }

      /* jsdoc — tags */
      case "JSDocTypeTag":
      case "JSDocThisTag":
      case "JSDocEnumTag":
      case "JSDocSatisfiesTag":
        return concat([
          "@",
          this.emit(node.tagName),
          " ",
          this.emit(node.typeExpression),
          this.jsDocComment(node.comment),
        ]);
      case "JSDocReturnTag":
      case "JSDocThrowsTag":
        return concat([
          "@",
          this.emit(node.tagName),
          node.typeExpression
            ? concat([" ", this.emit(node.typeExpression)])
            : "",
          this.jsDocComment(node.comment),
        ]);
      case "JSDocAuthorTag":
      case "JSDocClassTag":
      case "JSDocPublicTag":
      case "JSDocPrivateTag":
      case "JSDocProtectedTag":
      case "JSDocReadonlyTag":
      case "JSDocOverrideTag":
      case "JSDocDeprecatedTag":
      case "JSDocUnknownTag":
        return concat([
          "@",
          this.emit(node.tagName),
          this.jsDocComment(node.comment),
        ]);
      case "JSDocAugmentsTag":
      case "JSDocImplementsTag":
        return concat([
          "@",
          this.emit(node.tagName),
          " {",
          this.emit(node.class),
          "}",
          this.jsDocComment(node.comment),
        ]);
      case "JSDocParameterTag":
      case "JSDocPropertyTag": {
        const name: Doc = node.isBracketed
          ? concat(["[", this.emit(node.name), "]"])
          : this.emit(node.name);
        const type: Doc | undefined = node.typeExpression
          ? this.emit(node.typeExpression)
          : undefined;
        const main: Doc = node.isNameFirst
          ? concat([name, type ? concat([" ", type]) : ""])
          : concat([type ? concat([type, " "]) : "", name]);
        return concat([
          "@",
          this.emit(node.tagName),
          " ",
          main,
          this.jsDocComment(node.comment),
        ]);
      }
      case "JSDocSeeTag":
        return concat([
          "@",
          this.emit(node.tagName),
          node.name ? concat([" ", this.emit(node.name)]) : "",
          this.jsDocComment(node.comment),
        ]);
      case "JSDocOverloadTag":
      case "JSDocCallbackTag": {
        const full: Doc =
          node.kind === "JSDocCallbackTag" && node.fullName
            ? concat([" ", this.emit(node.fullName)])
            : "";
        return concat([
          "@",
          this.emit(node.tagName),
          full,
          hardline,
          this.emit(node.typeExpression),
          this.jsDocComment(node.comment),
        ]);
      }
      case "JSDocImportTag":
        return concat([
          "@",
          this.emit(node.tagName),
          " ",
          node.importClause
            ? concat([this.emit(node.importClause), " from "])
            : "",
          this.emit(node.moduleSpecifier),
          this.jsDocComment(node.comment),
        ]);
      case "JSDocTemplateTag":
        return concat([
          "@",
          this.emit(node.tagName),
          node.constraint ? concat([" ", this.emit(node.constraint)]) : "",
          " ",
          join(
            ", ",
            node.typeParameters.map((t) => this.emit(t)),
          ),
          this.jsDocComment(node.comment),
        ]);
      case "JSDocTypedefTag":
        return concat([
          "@",
          this.emit(node.tagName),
          node.typeExpression
            ? concat([" ", this.emit(node.typeExpression)])
            : "",
          node.fullName ? concat([" ", this.emit(node.fullName)]) : "",
          this.jsDocComment(node.comment),
        ]);

      default:
        return this.unsupported(node);
    }
  }

  /**
   * Emit a type in the operand position of a postfix type (`T[]`, `T[K]`),
   * parenthesizing the lower-precedence type forms that would otherwise
   * re-associate — matching the legacy printer's parenthesizer rules.
   */
  private parenthesizedExpression(expression: Expression): Doc {
    return expression.kind === "ParenthesizedExpression"
      ? this.emit(expression)
      : concat(["(", this.emit(expression), ")"]);
  }

  private expressionForDisallowedComma(expression: Expression): Doc {
    return this.expressionPrecedence(expression) > ExpressionPrecedence.Comma
      ? this.emit(expression)
      : this.parenthesizedExpression(expression);
  }

  private leftSideExpression(expression: Expression): Doc {
    return this.isLeftHandSideExpression(expression)
      ? this.emit(expression)
      : this.parenthesizedExpression(expression);
  }

  private newExpressionTarget(expression: Expression): Doc {
    return expression.kind !== "CallExpression" &&
      expression.kind !== "CallChain" &&
      (expression.kind !== "NewExpression" ||
        expression.arguments !== undefined) &&
      this.isLeftHandSideExpression(expression)
      ? this.emit(expression)
      : this.parenthesizedExpression(expression);
  }

  private prefixUnaryOperand(operand: Expression, operator?: SyntaxKind): Doc {
    const body: Doc = this.isUnaryExpression(operand)
      ? this.emit(operand)
      : this.parenthesizedExpression(operand);
    return this.needsPrefixUnaryGap(operator, operand)
      ? concat([" ", body])
      : body;
  }

  private postfixUnaryOperand(operand: Expression): Doc {
    return this.isLeftHandSideExpression(operand)
      ? this.emit(operand)
      : this.parenthesizedExpression(operand);
  }

  private conditionalCondition(condition: Expression): Doc {
    return this.expressionPrecedence(condition) >
      ExpressionPrecedence.Conditional
      ? this.emit(condition)
      : this.parenthesizedExpression(condition);
  }

  private conditionalBranch(branch: Expression): Doc {
    return this.expressionForDisallowedComma(branch);
  }

  private arrowFunctionBody(body: Block | Expression): Doc {
    return body.kind === "Block"
      ? this.emit(body)
      : this.expressionNeedsConciseBodyParentheses(body)
        ? this.parenthesizedExpression(body)
        : this.emit(body);
  }

  private expressionStatementExpression(expression: Expression): Doc {
    return this.expressionNeedsStatementParentheses(expression)
      ? this.parenthesizedExpression(expression)
      : this.emit(expression);
  }

  private exportAssignmentExpression(
    expression: Expression,
    isExportEquals: boolean,
  ): Doc {
    return isExportEquals
      ? this.expressionForDisallowedComma(expression)
      : this.expressionNeedsExportDefaultParentheses(expression)
        ? this.parenthesizedExpression(expression)
        : this.emit(expression);
  }

  private assertionExpressionOperand(expression: Expression): Doc {
    return this.expressionPrecedence(expression) >=
      ExpressionPrecedence.Relational
      ? this.expressionForDisallowedComma(expression)
      : this.parenthesizedExpression(expression);
  }

  private binaryOperand(
    operator: SyntaxKind,
    operand: Expression,
    isLeftSide: boolean,
    leftOperand?: Expression,
  ): Doc {
    return this.binaryOperandNeedsParentheses(
      operator,
      operand,
      isLeftSide,
      leftOperand,
    )
      ? this.parenthesizedExpression(operand)
      : this.emit(operand);
  }

  private binaryOperandNeedsParentheses(
    operator: SyntaxKind,
    operand: Expression,
    isLeftSide: boolean,
    leftOperand?: Expression,
  ): boolean {
    if (operand.kind === "ParenthesizedExpression") return false;
    if (
      operator === SyntaxKind.AsteriskAsteriskToken &&
      isLeftSide &&
      this.expressionPrecedence(operand) === ExpressionPrecedence.Unary
    )
      return true;
    if (
      operand.kind === "BinaryExpression" &&
      this.mixingBinaryOperatorsRequiresParentheses(operator, operand.operator)
    )
      return true;

    const operatorPrecedence: ExpressionPrecedence =
      this.binaryOperatorPrecedence(operator);
    const operandPrecedence: ExpressionPrecedence =
      this.expressionPrecedence(operand);
    if (
      !isLeftSide &&
      operand.kind === "ArrowFunction" &&
      operatorPrecedence > ExpressionPrecedence.Assignment
    )
      return true;
    if (operandPrecedence < operatorPrecedence) return true;
    if (operandPrecedence > operatorPrecedence) return false;

    if (isLeftSide)
      return this.binaryOperatorAssociativity(operator) === Associativity.Right;
    if (operand.kind === "BinaryExpression" && operand.operator === operator) {
      if (this.operatorHasAssociativeProperty(operator)) return false;
      if (
        operator === SyntaxKind.PlusToken &&
        leftOperand !== undefined &&
        this.literalKindOfBinaryPlusOperand(leftOperand) !== undefined &&
        this.literalKindOfBinaryPlusOperand(leftOperand) ===
          this.literalKindOfBinaryPlusOperand(operand)
      )
        return false;
    }
    return this.expressionAssociativity(operand) === Associativity.Left;
  }

  private expressionPrecedence(expression: Expression): ExpressionPrecedence {
    switch (expression.kind) {
      case "CommaListExpression":
        return ExpressionPrecedence.Comma;
      case "YieldExpression":
        return ExpressionPrecedence.Yield;
      case "ConditionalExpression":
        return ExpressionPrecedence.Conditional;
      case "BinaryExpression":
        return this.binaryOperatorPrecedence(expression.operator);
      case "AsExpression":
      case "SatisfiesExpression":
        return ExpressionPrecedence.Relational;
      case "TypeAssertion":
      case "PrefixUnaryExpression":
      case "TypeOfExpression":
      case "VoidExpression":
      case "DeleteExpression":
      case "AwaitExpression":
      case "NonNullExpression":
      case "NonNullChain":
        return ExpressionPrecedence.Unary;
      case "PostfixUnaryExpression":
        return ExpressionPrecedence.Update;
      case "CallExpression":
      case "CallChain":
        return ExpressionPrecedence.LeftHandSide;
      case "NewExpression":
      case "TaggedTemplateExpression":
      case "PropertyAccessExpression":
      case "PropertyAccessChain":
      case "ElementAccessExpression":
      case "ElementAccessChain":
      case "MetaProperty":
        return ExpressionPrecedence.Member;
      default:
        return ExpressionPrecedence.Primary;
    }
  }

  private expressionAssociativity(expression: Expression): Associativity {
    switch (expression.kind) {
      case "NewExpression":
        return expression.arguments === undefined
          ? Associativity.Right
          : Associativity.Left;
      case "PrefixUnaryExpression":
      case "TypeOfExpression":
      case "VoidExpression":
      case "DeleteExpression":
      case "AwaitExpression":
      case "ConditionalExpression":
      case "YieldExpression":
        return Associativity.Right;
      case "BinaryExpression":
        return this.binaryOperatorAssociativity(expression.operator);
      default:
        return Associativity.Left;
    }
  }

  private binaryOperatorPrecedence(operator: SyntaxKind): ExpressionPrecedence {
    switch (operator) {
      case SyntaxKind.CommaToken:
        return ExpressionPrecedence.Comma;
      case SyntaxKind.EqualsToken:
      case SyntaxKind.PlusEqualsToken:
      case SyntaxKind.MinusEqualsToken:
      case SyntaxKind.AsteriskEqualsToken:
      case SyntaxKind.SlashEqualsToken:
      case SyntaxKind.QuestionQuestionEqualsToken:
        return ExpressionPrecedence.Assignment;
      case SyntaxKind.QuestionQuestionToken:
      case SyntaxKind.BarBarToken:
        return ExpressionPrecedence.LogicalOR;
      case SyntaxKind.AmpersandAmpersandToken:
        return ExpressionPrecedence.LogicalAND;
      case SyntaxKind.BarToken:
        return ExpressionPrecedence.BitwiseOR;
      case SyntaxKind.CaretToken:
        return ExpressionPrecedence.BitwiseXOR;
      case SyntaxKind.AmpersandToken:
        return ExpressionPrecedence.BitwiseAND;
      case SyntaxKind.EqualsEqualsToken:
      case SyntaxKind.ExclamationEqualsToken:
      case SyntaxKind.EqualsEqualsEqualsToken:
      case SyntaxKind.ExclamationEqualsEqualsToken:
        return ExpressionPrecedence.Equality;
      case SyntaxKind.LessThanToken:
      case SyntaxKind.LessThanEqualsToken:
      case SyntaxKind.GreaterThanToken:
      case SyntaxKind.GreaterThanEqualsToken:
      case SyntaxKind.InstanceOfKeyword:
      case SyntaxKind.InKeyword:
      case SyntaxKind.AsKeyword:
      case SyntaxKind.SatisfiesKeyword:
        return ExpressionPrecedence.Relational;
      case SyntaxKind.LessThanLessThanToken:
      case SyntaxKind.GreaterThanGreaterThanToken:
      case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
        return ExpressionPrecedence.Shift;
      case SyntaxKind.PlusToken:
      case SyntaxKind.MinusToken:
        return ExpressionPrecedence.Additive;
      case SyntaxKind.AsteriskToken:
      case SyntaxKind.SlashToken:
      case SyntaxKind.PercentToken:
        return ExpressionPrecedence.Multiplicative;
      case SyntaxKind.AsteriskAsteriskToken:
        return ExpressionPrecedence.Exponentiation;
      default:
        return ExpressionPrecedence.Invalid;
    }
  }

  private binaryOperatorAssociativity(operator: SyntaxKind): Associativity {
    switch (operator) {
      case SyntaxKind.AsteriskAsteriskToken:
      case SyntaxKind.EqualsToken:
      case SyntaxKind.PlusEqualsToken:
      case SyntaxKind.MinusEqualsToken:
      case SyntaxKind.AsteriskEqualsToken:
      case SyntaxKind.SlashEqualsToken:
      case SyntaxKind.QuestionQuestionEqualsToken:
        return Associativity.Right;
      default:
        return Associativity.Left;
    }
  }

  private mixingBinaryOperatorsRequiresParentheses(
    left: SyntaxKind,
    right: SyntaxKind,
  ): boolean {
    return (
      (left === SyntaxKind.QuestionQuestionToken &&
        (right === SyntaxKind.AmpersandAmpersandToken ||
          right === SyntaxKind.BarBarToken)) ||
      (right === SyntaxKind.QuestionQuestionToken &&
        (left === SyntaxKind.AmpersandAmpersandToken ||
          left === SyntaxKind.BarBarToken))
    );
  }

  private operatorHasAssociativeProperty(operator: SyntaxKind): boolean {
    return (
      operator === SyntaxKind.AsteriskToken ||
      operator === SyntaxKind.BarToken ||
      operator === SyntaxKind.AmpersandToken ||
      operator === SyntaxKind.CaretToken ||
      operator === SyntaxKind.CommaToken
    );
  }

  private literalKindOfBinaryPlusOperand(
    expression: Expression,
  ): string | undefined {
    switch (expression.kind) {
      case "StringLiteral":
      case "NumericLiteral":
      case "BigIntLiteral":
        return expression.kind;
      case "BinaryExpression": {
        if (expression.operator !== SyntaxKind.PlusToken) return undefined;
        const left: string | undefined = this.literalKindOfBinaryPlusOperand(
          expression.left,
        );
        return left !== undefined &&
          left === this.literalKindOfBinaryPlusOperand(expression.right)
          ? left
          : undefined;
      }
      default:
        return undefined;
    }
  }

  private isUnaryExpression(expression: Expression): boolean {
    return this.expressionPrecedence(expression) >= ExpressionPrecedence.Unary;
  }

  private isLeftHandSideExpression(expression: Expression): boolean {
    switch (expression.kind) {
      case "ArrowFunction":
      case "ClassExpression":
      case "FunctionExpression":
      case "NumericLiteral":
      case "ObjectLiteralExpression":
        return false;
      default:
        break;
    }
    return (
      this.expressionPrecedence(expression) >=
        ExpressionPrecedence.LeftHandSide ||
      expression.kind === "NonNullExpression" ||
      expression.kind === "NonNullChain"
    );
  }

  private expressionNeedsStatementParentheses(expression: Expression): boolean {
    const leftmost: Expression = this.leftmostExpression(expression);
    return (
      leftmost.kind === "FunctionExpression" ||
      leftmost.kind === "ObjectLiteralExpression"
    );
  }

  private expressionNeedsConciseBodyParentheses(
    expression: Expression,
  ): boolean {
    return (
      this.expressionPrecedence(expression) <= ExpressionPrecedence.Comma ||
      this.leftmostExpression(expression).kind === "ObjectLiteralExpression"
    );
  }

  private expressionNeedsExportDefaultParentheses(
    expression: Expression,
  ): boolean {
    const leftmost: Expression = this.leftmostExpression(expression);
    return (
      this.expressionPrecedence(expression) <= ExpressionPrecedence.Comma ||
      leftmost.kind === "ClassExpression" ||
      leftmost.kind === "FunctionExpression"
    );
  }

  private leftmostExpression(expression: Expression): Expression {
    switch (expression.kind) {
      case "AsExpression":
      case "CallExpression":
      case "CallChain":
      case "ElementAccessExpression":
      case "ElementAccessChain":
      case "NonNullExpression":
      case "NonNullChain":
      case "PropertyAccessExpression":
      case "PropertyAccessChain":
      case "SatisfiesExpression":
        return this.leftmostExpression(expression.expression);
      case "BinaryExpression":
        return this.leftmostExpression(expression.left);
      case "ConditionalExpression":
        return this.leftmostExpression(expression.condition);
      case "TaggedTemplateExpression":
        return this.leftmostExpression(expression.tag);
      default:
        return expression;
    }
  }

  private needsPrefixUnaryGap(
    operator: SyntaxKind | undefined,
    operand: Expression,
  ): boolean {
    if (operator === undefined || operand.kind !== "PrefixUnaryExpression")
      return false;
    return (
      (operator === SyntaxKind.PlusToken &&
        (operand.operator === SyntaxKind.PlusToken ||
          operand.operator === SyntaxKind.PlusPlusToken)) ||
      (operator === SyntaxKind.MinusToken &&
        (operand.operator === SyntaxKind.MinusToken ||
          operand.operator === SyntaxKind.MinusMinusToken))
    );
  }

  private parenthesizedType(type: TypeNode): Doc {
    return type.kind === "ParenthesizedTypeNode"
      ? this.emit(type)
      : concat(["(", this.emit(type), ")"]);
  }

  private conditionalTypeCheckOperand(type: TypeNode): Doc {
    return type.kind === "FunctionTypeNode" ||
      type.kind === "ConstructorTypeNode" ||
      type.kind === "ConditionalTypeNode"
      ? this.parenthesizedType(type)
      : this.emit(type);
  }

  private conditionalTypeExtendsOperand(type: TypeNode): Doc {
    return type.kind === "ConditionalTypeNode"
      ? this.parenthesizedType(type)
      : this.emit(type);
  }

  private typeOperatorOperand(type: TypeNode, operator: SyntaxKind): Doc {
    return this.typeOperatorOperandNeedsParentheses(type, operator)
      ? this.parenthesizedType(type)
      : this.emit(type);
  }

  private typeOperatorOperandNeedsParentheses(
    type: TypeNode,
    operator?: SyntaxKind,
  ): boolean {
    return (
      type.kind === "UnionTypeNode" ||
      type.kind === "IntersectionTypeNode" ||
      type.kind === "FunctionTypeNode" ||
      type.kind === "ConstructorTypeNode" ||
      type.kind === "ConditionalTypeNode" ||
      (operator === SyntaxKind.ReadonlyKeyword &&
        type.kind === "TypeOperatorNode")
    );
  }

  private postfixTypeOperand(type: TypeNode): Doc {
    return this.postfixTypeOperandNeedsParentheses(type)
      ? this.parenthesizedType(type)
      : this.emit(type);
  }

  private postfixTypeOperandNeedsParentheses(type: TypeNode): boolean {
    return (
      type.kind === "InferTypeNode" ||
      type.kind === "TypeOperatorNode" ||
      type.kind === "TypeQueryNode" ||
      this.typeOperatorOperandNeedsParentheses(type)
    );
  }

  /** Render a JSDoc tag's trailing comment, prefixed with a space when present. */
  private jsDocComment(comment: string | readonly Node[] | undefined): Doc {
    if (comment === undefined) return "";
    if (typeof comment === "string")
      return comment.length ? concat([" ", comment]) : "";
    return comment.length
      ? concat([" ", concat(comment.map((c) => this.emit(c)))])
      : "";
  }

  /** Width-aware `|` / `&` type list with leading-operator breaks. */
  private binaryType(operator: "|" | "&", types: readonly TypeNode[]): Doc {
    const parts: Doc[] = this.flattenBinaryTypes(operator, types).map((type) =>
      this.binaryTypeOperand(operator, type),
    );
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

  private flattenBinaryTypes(
    operator: "|" | "&",
    types: readonly TypeNode[],
  ): TypeNode[] {
    const flattened: TypeNode[] = [];
    for (const type of types)
      if (operator === "|" && type.kind === "UnionTypeNode")
        flattened.push(...this.flattenBinaryTypes(operator, type.types));
      else if (operator === "&" && type.kind === "IntersectionTypeNode")
        flattened.push(...this.flattenBinaryTypes(operator, type.types));
      else flattened.push(type);
    return flattened;
  }

  private binaryTypeOperand(operator: "|" | "&", type: TypeNode): Doc {
    return this.binaryTypeOperandNeedsParentheses(operator, type)
      ? this.parenthesizedType(type)
      : this.emit(type);
  }

  private binaryTypeOperandNeedsParentheses(
    operator: "|" | "&",
    type: TypeNode,
  ): boolean {
    return (
      type.kind === "FunctionTypeNode" ||
      type.kind === "ConstructorTypeNode" ||
      type.kind === "ConditionalTypeNode" ||
      type.kind === "UnionTypeNode" ||
      (operator === "|" && type.kind === "IntersectionTypeNode")
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

export namespace TsPrinter {
  /** Options for {@link TsPrinter}. */
  export interface IProps {
    /** Maximum line width before groups break. Defaults to `80`. */
    printWidth?: number;
    /** Indentation unit. Defaults to two spaces. */
    indent?: string;
    /** New line sequence. Defaults to `"\n"` (LineFeed). */
    newLine?: string;
  }
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

const ExpressionPrecedence = {
  Comma: 0,
  Yield: 2,
  Assignment: 3,
  Conditional: 4,
  LogicalOR: 5,
  LogicalAND: 6,
  BitwiseOR: 7,
  BitwiseXOR: 8,
  BitwiseAND: 9,
  Equality: 10,
  Relational: 11,
  Shift: 12,
  Additive: 13,
  Multiplicative: 14,
  Exponentiation: 15,
  Unary: 16,
  Update: 17,
  LeftHandSide: 18,
  Member: 19,
  Primary: 20,
  Invalid: -1,
} as const;

type ExpressionPrecedence =
  (typeof ExpressionPrecedence)[keyof typeof ExpressionPrecedence];

const Associativity = {
  Left: "left",
  Right: "right",
} as const;

type Associativity = (typeof Associativity)[keyof typeof Associativity];
