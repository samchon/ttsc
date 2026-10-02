import type {
  BinaryExpression,
  Block,
  ConditionalExpression,
  Expression,
  ForInitializer,
  Identifier,
  JSDocTypeLiteral,
  ModifierLike,
  Node,
  SourceFile,
  Statement,
  TypeNode,
  VariableDeclaration,
  VariableDeclarationList,
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
  raw,
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
 * Nodes must form an acyclic, well-formed outline tree. Factory typing does not
 * validate lexical spellings, legal assignment targets or complete TypeScript
 * grammar; callers remain responsible for those input constraints. Width counts
 * JavaScript string units, rather than terminal display columns.
 *
 * The printer adds the parentheses and blocks that keep the printed tree equal
 * to the parsed tree where TypeScript's grammar would otherwise bind
 * differently, such as a statement that starts with an object literal, a
 * `for` header holding `in`, or an `else` after a nested `if`. TypeScript reads
 * a `<` after an expression as the start of type arguments when a later `>` is
 * followed by `(`, a template or a line break, as in `f(a < b, c > (d))`. The
 * printer parenthesizes the comparison, or writes its right operand as
 * `(+0 as number, ...)` when that operand holds the closing `>`, and never
 * breaks a line after `>` or `>>`. An identifier spelled `let` at the start of
 * a statement is the caller's to avoid, because identifier spellings are not
 * validated.
 *
 * Quoted JSX attributes encode their cooked string values with entities. A value
 * containing an unpaired UTF-16 surrogate uses a JSX expression instead, because
 * native entity decoding cannot represent that code unit. JavaScript string
 * and JSX expression literals use JavaScript escapes.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @example
 *   ```typescript
 *   import factory, { TsPrinter } from "@ttsc/factory";
 *
 *   const printer = new TsPrinter({ printWidth: 80, indent: "  " });
 *   printer.print(factory.createStringLiteral("hello")); // "hello"
 *   ```
 * @evidence contracts/common.md#principled-implementation Discriminant dispatch lowers each outline kind to grammar-specific documents; precedence, associativity, optional-chain boundaries and assignment-target context constrain parentheses and commas independently of layout. Numeric and bitwise operands retain grouping because rounding and observable conversions forbid general reassociation; class expression statements preserve expression-local names. Parentheses and blocks also cover the grammar slots a fuzz against the TypeScript parser showed to rebind: `new` targets, `as`/`satisfies` before `&`, `|`, `<` or a conditional `?`, statement-leading comma lists, `for`-header `in`, dangling `else`, `for...of` sources and decorator element access. A `<` comparison that a later `>` followed by `(` or a template could pair with into type arguments is parenthesized, or its right operand is written as `(+0 as number, ...)`, so the printed tree parses back to the same tree. Inputs must be well-formed acyclic trees; arbitrary typed shapes are not a grammar validator.
 * @evidence contracts/common.md#clear-and-simple-design The instance retains only three layout settings; private helpers own grammar boundaries, comment rendering and list layout, while the document engine owns width decisions. The exhaustive switch keeps node lowering visible in one owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Grammar exceptions such as rest-target commas and JSX whitespace preserve supported syntax and meaning rather than fixture answers; the printer reads package-owned comment metadata and does not patch a compiler or consumer.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains width-aware output, outline input constraints and string-unit width; examples and separately documented options apply the documentation skill's paragraph separation and reasons for nonobvious limits.
 * @evidence contracts/performance.md#efficient-algorithms The private helpers use ordered document arrays and explicit layout stacks; union/intersection flattening visits each nested constituent once without recursive array copying. Precedence scans and group-fit lookahead can revisit subtrees, and a `<` comparison left open triggers one scan of the printed subtrees that follow it for a closing `>`, so total work depends on tree shape and configured width as well as node and text counts.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The instance is a synchronous renderer with immutable layout settings, not a cross-request computation coordinator. Node fields and synthetic-comment lists can change, so a tree identity alone cannot validate stored output.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The instance owns only its three scalar layout settings; each print call owns transient document and output buffers and retains no tree, history or native handle after completion or failure. The caller owns the returned text and the node/comment lifetime.
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

  /**
   * Print a single node (or a whole {@link SourceFile}) into source text.
   *
   * The call reads current node and synthetic-comment contents. It does not
   * cache text across later changes to that tree.
   *
   * @evidence contracts/common.md#principled-implementation Grammar-aware emission creates a document before width layout, so necessary parentheses and meaning-sensitive punctuation are decided from the outline tree rather than output width.
   * @evidence contracts/common.md#clear-and-simple-design The public operation composes the two existing owners, node emission and document layout, without a parallel printing pipeline.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts All nodes use the same discriminant and grammar rules; current synthetic metadata is read through public helpers without replacing foreign APIs.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies supported whole-file use and current mutable-content reads, with a separate paragraph before tags following the documentation skill.
   * @evidence contracts/performance.md#efficient-algorithms Emission allocates documents proportional to traversed nodes and text, and linear-stack union/intersection flattening avoids copying descendants at every nesting level. Grammar lookahead and group fit checks can revisit subtrees, so adversarial nesting can still require quadratic time; the implementation does not claim a universal linear bound.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This call lowers a current mutable tree and current weak-store comments; it does not own a cross-request coordinator or a producer validity protocol. Adding identity-only text caching would change subsequent reads after mutation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The call owns its temporary documents, layout command stacks and output fragments; they become unreachable after return or throw, with live memory driven by input tree and output size rather than previous calls. The printer instance retains only its three layout settings.
   */
  public print(node: Node): string {
    return this.layout(this.emit(node));
  }

  /**
   * Print multiple nodes, joining them with new lines.
   *
   * The sequence is laid out together, with a mandatory separator between
   * adjacent nodes and no additional separator for an empty sequence.
   *
   * @evidence contracts/common.md#principled-implementation Each node is emitted by the same grammar owner and hardline joining represents sequence boundaries before one layout; an empty join produces empty text.
   * @evidence contracts/common.md#clear-and-simple-design One mapped document sequence and the shared join operation express ordering explicitly, without independently maintained concatenation or per-node layout logic.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Hardline separators implement the public multi-node contract uniformly; no fixture-specific branch or external printer patch supplies the result.
   * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs state joining, mandatory boundaries and empty behavior, applying the documentation skill's useful information and paragraph separation.
   * @evidence contracts/performance.md#efficient-algorithms Root mapping and hardline joining are linear in root count, with one shared layout of the emitted document sequence. Descendant emission and fit lookahead determine the remaining cost, including possible quadratic revisits under adversarial nesting; flattened binary types use one work stack.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This sequence-lowering call observes current node and comment contents without coordinating other requests. Shared object identity alone supplies no invalidation witness for persistent rendered text.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The root document list, join parts, command stacks and string fragments belong to this synchronous call and are released from reachability on completion or failure. Their population follows current roots and descendant/output size; previous print calls add no retained history.
   */
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
   * A supplied source file takes precedence over `statements`. The output ends
   * with one configured newline, including when the selected statement list is empty.
   *
   * @param sourceFile A {@link SourceFile}. When omitted, one is composed from
   *   the given `statements`.
   * @param statements Statements to compose a source file from when no
   *   `sourceFile` is provided.
   * @evidence contracts/common.md#principled-implementation The chosen statement sequence is exactly the supplied source file's list or the fallback list; shared emission and hardline joining render that sequence before the contract's final newline.
   * @evidence contracts/common.md#clear-and-simple-design Selection is one explicit precedence decision and printing reuses the existing emission and layout owners; no synthetic SourceFile allocation is needed.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Source-file precedence and final newline are supported API behavior, not input-name exceptions or compensating printer wrappers.
   * @evidence contracts/common.md#meaningful-documentation Native prose and parameter tags identify argument precedence, fallback use and empty-file newline behavior, with separate ideas and the documentation skill's prose-to-tag spacing.
   * @evidence contracts/performance.md#efficient-algorithms The chosen statement list is mapped and joined once without allocating a synthetic source-file node. Costs follow statement count, descendant nodes and output text; grammar and fit lookahead may revisit nested documents, while binary-type flattening visits each flattened descendant once.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This call selects and lowers the supplied current statement list, rather than coordinating completed work across consumers. Mutable nodes and side-band comment lists lack a version protocol for cross-call text reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Temporary statement documents and layout buffers live only through this call and its returned string construction; error unwinding retains no per-file cache or handle. Memory grows with the chosen tree and produced text, while the final string's lifetime belongs to its caller.
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
      trailingComma?: TrailingComma;
      forceBreak?: boolean;
    } = {},
  ): Doc {
    if (items.length === 0) return open + close;
    const ln = opts.space ? line : softline;
    return group(
      concat([
        open,
        indent(concat([ln, join(concat([",", line]), items)])),
        opts.trailingComma === "always"
          ? ","
          : opts.trailingComma === "onBreak"
            ? ifBreak(",")
            : "",
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
   *
   * A not-emitted placeholder occupies no slot: it leaves no separator behind,
   * and one that carries synthetic comments prints just those comments, with no
   * `;` of its own.
   */
  private memberBlock(members: readonly Node[], forceBreak: boolean): Doc {
    const inner: Doc[] = [];
    let first: boolean = true;
    let blank: boolean = false;
    let terminated: boolean = false;
    for (const member of members) {
      if (member.kind === "Identifier") {
        blank = true;
        continue;
      }
      const placeholder: boolean = member.kind === "NotEmittedTypeElement";
      if (placeholder && !this.hasSyntheticComments(member)) continue;
      if (!first) inner.push(...(terminated ? [";"] : []), line);
      if (blank) {
        inner.push(hardline);
        blank = false;
      }
      inner.push(this.emit(member));
      first = false;
      terminated = !placeholder;
    }
    if (inner.length === 0) return "{}";
    return group(
      concat([
        "{",
        indent(concat([line, concat(inner)])),
        terminated ? ifBreak(";") : "",
        line,
        "}",
      ]),
      forceBreak,
    );
  }

  /** The `; a; b;` tail of a mapped type, without not-emitted placeholders. */
  private mappedTypeMembers(members: readonly Node[] | undefined): Doc {
    const emitted: Node[] = (members ?? []).filter(
      (member) =>
        member.kind !== "NotEmittedTypeElement" ||
        this.hasSyntheticComments(member),
    );
    return emitted.length === 0
      ? ""
      : concat([
          "; ",
          join(
            "; ",
            emitted.map((member) => this.emit(member)),
          ),
          ";",
        ]);
  }

  /**
   * The right operand of a binary expression. When the operator is `<` or `<<`
   * and the operand holds a `>` that closes a type list, a leading `+0 as number`
   * operand in parentheses keeps TypeScript from reading the `<` as type
   * arguments and leaves the operand's value unchanged. The assertion keeps the
   * checker from reporting the unused left side of the comma (TS2695).
   */
  private lessRightOperand(node: BinaryExpression): Doc {
    if (
      (node.operator === SyntaxKind.LessThanToken ||
        node.operator === SyntaxKind.LessThanLessThanToken) &&
      this.containsClosingOpener(node.right)
    )
      return concat([
        "(+0 as number, ",
        this.expressionForDisallowedComma(node.right),
        ")",
      ]);
    return this.binaryOperand(node.operator, node.right, false, node.left);
  }

  private hasSyntheticComments(node: Node): boolean {
    return (
      (getSyntheticLeadingComments(node)?.length ?? 0) !== 0 ||
      (getSyntheticTrailingComments(node)?.length ?? 0) !== 0
    );
  }

  /** Statement block; callers choose whether the group must break. */
  private statementBlock(items: Doc[], forceBreak: boolean = true): Doc {
    if (items.length === 0) return "{}";
    return group(
      concat([
        "{",
        indent(concat([line, join(line, items)])),
        line,
        "}",
      ]),
      forceBreak,
    );
  }

  private typeArguments(args: readonly Node[] | undefined): Doc {
    // type-argument / type-parameter lists disallow a trailing comma (TS1009)
    return args && args.length
      ? this.delim(
          "<",
          args.map((a) => this.emit(a)),
          ">",
          {
            trailingComma: "never",
          },
        )
      : "";
  }

  /**
   * Trailing-comma policy for a parameter list or binding pattern.
   *
   * A comma the printer adds only because a group broke must never change
   * whether the text parses, nor what it parses to. After a rest element
   * (`...rest`) it changes the first: a trailing comma there is a syntax error
   * (TS1013 / V8 `SyntaxError`). After a trailing elision it changes the
   * second: `[a, ,]` has one more hole than `[a, ]`, so the flat and broken
   * layouts of the same node would disagree. A binding pattern is the one place
   * where dropping that hole is lossless, since a trailing hole binds nothing;
   * {@link literalTrailingComma} materializes it instead, because in an array
   * literal the hole is a value.
   */
  private listTrailingComma(nodes: readonly Node[]): TrailingComma {
    const last: Node | undefined = nodes[nodes.length - 1];
    if (last === undefined) return "onBreak";
    if (last.kind === "OmittedExpression") return "never";
    return "dotDotDotToken" in last && last.dotDotDotToken !== undefined
      ? "never"
      : "onBreak";
  }

  /**
   * Trailing-comma policy for a call or `new` argument list.
   *
   * A trailing `OmittedExpression` prints as nothing, so the list already ends
   * in the separator comma of its last real argument: `f(a, )`, which is what
   * the legacy printer emits too and parses as one argument. Adding the break
   * comma on top produces `f(a, ,)`, which is a syntax error. A trailing spread
   * is unaffected — a comma after it is legal in an argument list.
   */
  private argsTrailingComma(args: readonly Expression[]): TrailingComma {
    const last: Expression | undefined = args[args.length - 1];
    return last !== undefined && last.kind === "OmittedExpression"
      ? "never"
      : "onBreak";
  }

  /**
   * Trailing-comma policy for an array or object literal.
   *
   * Two positions make the comma load-bearing rather than cosmetic.
   *
   * A trailing elision is a **value**: the comma is the token that materializes
   * the hole, so `["a", ]` has one element and `["a", ,]` has two. The legacy
   * printer emits it in every layout, so this printer emits it in every layout
   * too; leaving it to the break would make the same node mean different things
   * at different widths.
   *
   * A destructuring **assignment target** is the same node kind as an rvalue
   * literal, but ECMAScript forbids a comma after its `AssignmentRestElement` /
   * `AssignmentRestProperty`: `[a, ...rest,] = source` is a syntax error, while
   * the identical rvalue `[a, ...rest,]` is legal. Only the target position
   * suppresses it, so the rvalue twin keeps its break comma.
   */
  private literalTrailingComma(
    elements: readonly Node[],
    assignmentTarget: boolean,
  ): TrailingComma {
    const last: Node | undefined = elements[elements.length - 1];
    if (last === undefined) return "onBreak";
    if (last.kind === "OmittedExpression") return "always";
    return assignmentTarget &&
      (last.kind === "SpreadElement" || last.kind === "SpreadAssignment")
      ? "never"
      : "onBreak";
  }

  private params(params: readonly Node[]): Doc {
    return this.delim(
      "(",
      params.map((p) => this.emit(p)),
      ")",
      {
        trailingComma: this.listTrailingComma(params),
      },
    );
  }

  private args(args: readonly Expression[]): Doc {
    return this.delim(
      "(",
      args.map((_a, i) => this.listElement(args, i)),
      ")",
      {
        trailingComma: this.argsTrailingComma(args),
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

  /**
   * Lay out a JSX element's or fragment's children.
   *
   * A line break between JSX children is not cosmetic. JSX deletes a
   * whitespace-only text child that contains a newline and trims
   * whitespace-carrying-a-newline off both edges of every other text child, so
   * a break introduced only because the group did not fit changes what the
   * component renders: `<div>Hello there, {name}!</div>` becomes `Hello
   * there,NAME!`, and the separator in `<div>{a} {b}</div>` disappears
   * outright.
   *
   * Children are therefore laid out across lines only when the break survives
   * that transformation unchanged: every text child must carry non-whitespace
   * content, must not begin or end with whitespace, and must not sit next to
   * another text child, since inserting a newline between two of them would
   * merge into one text with a space in the middle. Otherwise the children are
   * emitted verbatim on one line, whatever `printWidth` says — width may choose
   * a layout, never a meaning.
   */
  private jsxChildren(open: Doc, children: readonly Node[], close: Doc): Doc {
    if (!this.jsxChildrenMayBreak(children))
      return concat([open, concat(children.map((c) => this.emit(c))), close]);
    return group(
      concat([
        open,
        indent(concat(children.map((c) => concat([softline, this.emit(c)])))),
        softline,
        close,
      ]),
    );
  }

  private jsxChildrenMayBreak(children: readonly Node[]): boolean {
    return children.every(
      (child, index) =>
        child.kind !== "JsxText" ||
        (isBreakSafeJsxText(child.text) &&
          children[index + 1]?.kind !== "JsxText"),
    );
  }

  private optType(type: Node | undefined): Doc {
    return type ? concat([": ", this.emit(type)]) : "";
  }

  private optBody(body: Node | undefined): Doc {
    return body ? concat([" ", this.emit(body)]) : ";";
  }

  /**
   * @param assignmentTarget Whether `node` occupies destructuring
   *   assignment-target position, where an array or object literal is a pattern
   *   rather than a value. The flag is set by the assignment and `for…in` /
   *   `for…of` cases, forwarded by every node that is transparent to it (a
   *   spread, a property's initializer, a parenthesis, an `=` default), and
   *   dropped by every other node.
   */
  private emit(node: Node, assignmentTarget: boolean = false): Doc {
    return this.withComments(node, this.emitNode(node, assignmentTarget));
  }

  /** Attach node metadata around a body, including context-specific syntax. */
  private withComments(node: Node, body: Doc): Doc {
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

  private emitNode(node: Node, assignmentTarget: boolean): Doc {
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
        return concat(["@", this.decoratorExpression(node.expression)]);

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
          node.elements.map((_e, i) =>
            this.listElement(node.elements, i, assignmentTarget),
          ),
          "]",
          {
            trailingComma: this.literalTrailingComma(
              node.elements,
              assignmentTarget,
            ),
            forceBreak: node.multiLine === true,
          },
        );
      case "ObjectLiteralExpression":
        return this.delim(
          "{",
          node.properties.map((p) => this.emit(p, assignmentTarget)),
          "}",
          {
            space: true,
            trailingComma: this.literalTrailingComma(
              node.properties,
              assignmentTarget,
            ),
            forceBreak: node.multiLine === true,
          },
        );
      case "PropertyAssignment":
        return concat([
          this.emit(node.name),
          ": ",
          this.expressionForDisallowedComma(node.initializer, assignmentTarget),
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
          this.expressionForDisallowedComma(node.expression, assignmentTarget),
        ]);
      case "PropertyAccessExpression":
        return concat([
          this.leftSideExpression(node.expression, false),
          ".",
          this.emit(node.name),
        ]);
      case "ElementAccessExpression":
        return concat([
          this.leftSideExpression(node.expression, false),
          "[",
          this.expressionForDisallowedComma(node.argumentExpression),
          "]",
        ]);
      case "CallExpression":
        return concat([
          this.leftSideExpression(node.expression, false),
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
        return concat(["(", this.emit(node.expression, assignmentTarget), ")"]);
      case "BinaryExpression":
        // the left side of `=` is a destructuring assignment target, both for a
        // top-level assignment and for a `[a = init]` default inside one
        return group(
          concat([
            this.binaryOperand(
              node.operator,
              node.left,
              true,
              undefined,
              node.operator === SyntaxKind.EqualsToken,
              node.right,
            ),
            // Every operator but the comma is written with a space on each
            // side. The comma is punctuation that attaches to what precedes it:
            // `CommaListExpression` joins with ", ", the legacy printer and the
            // repository's pinned Prettier both emit `a, b`, and this factory's
            // own JSDoc for `createComma` shows `(a, b)`. Only the printer
            // disagreed, with `a , b`.
            node.operator === SyntaxKind.CommaToken ? "" : " ",
            node.operator,
            indent(
              concat([
                // A line break right after `>` or `>>` can make an earlier `<`
                // read as the start of type arguments, so those operators keep
                // their right operand on the same line.
                node.operator === SyntaxKind.GreaterThanToken ||
                node.operator === SyntaxKind.GreaterThanGreaterThanToken
                  ? " "
                  : line,
                this.lessRightOperand(node),
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
            this.conditionalCondition(node),
            indent(
              concat([
                line,
                "? ",
                this.conditionalBranch(node.whenTrue, node.whenFalse),
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
        return concat([
          this.postfixBoundaryOperand(
            node.expression,
            this.leftSideExpression(node.expression, false),
          ),
          "!",
        ]);
      case "SpreadElement":
        return concat([
          "...",
          this.expressionForDisallowedComma(node.expression, assignmentTarget),
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
            trailingComma: "onBreak",
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
        // heritage clauses take a LeftHandSideExpression: `class A extends
        // (X || Y) {}` does not parse without the parentheses, and a bare comma
        // sequence silently becomes two base classes
        return concat([
          this.leftSideExpression(node.expression, false),
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
      case "VariableDeclarationList":
        return this.variableDeclarationList(node, false);
      case "VariableDeclaration":
        return this.variableDeclaration(node, false);
      case "ExpressionStatement":
        return concat([
          this.expressionStatementExpression(node.expression),
          ";",
        ]);
      case "ReturnStatement":
        return node.expression
          ? concat(["return ", this.restrictedExpression(node.expression), ";"])
          : "return;";
      case "ThrowStatement":
        return concat(["throw ", this.restrictedExpression(node.expression), ";"]);
      case "IfStatement":
        return concat([
          "if (",
          this.emit(node.expression),
          ") ",
          node.elseStatement !== undefined &&
            this.endsWithElselessIf(node.thenStatement)
            ? this.statementBlock([this.emit(node.thenStatement)])
            : this.embeddedStatement(node.thenStatement),
          node.elseStatement
            ? concat([" else ", this.embeddedStatement(node.elseStatement)])
            : "",
        ]);
      case "Block":
        return this.statementBlock(
          node.statements.map((s) => this.emit(s)),
          node.multiLine !== false,
        );

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
        // The phase modifier is the keyword itself, so it prints as written —
        // `type` and `defer` both reach here, where a boolean could only ever
        // have produced the first.
        return concat([
          node.phaseModifier ? `${node.phaseModifier} ` : "",
          join(", ", named),
        ]);
      }
      case "NamedImports":
        return this.delim(
          "{",
          node.elements.map((e) => this.emit(e)),
          "}",
          { space: true, trailingComma: "onBreak" },
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
          { space: true, trailingComma: "onBreak" },
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
          node.initializer ? this.forInitializer(node.initializer) : "",
          "; ",
          node.condition ? this.emit(node.condition) : "",
          "; ",
          node.incrementor ? this.emit(node.incrementor) : "",
          ") ",
          this.embeddedStatement(node.statement),
        ]);
      case "ForInStatement":
        return concat([
          "for (",
          this.emit(node.initializer, true),
          " in ",
          this.emit(node.expression),
          ") ",
          this.embeddedStatement(node.statement),
        ]);
      case "ForOfStatement":
        return concat([
          "for ",
          node.awaitModifier ? "await " : "",
          "(",
          this.emit(node.initializer, true),
          " of ",
          this.expressionForDisallowedComma(node.expression),
          ") ",
          this.embeddedStatement(node.statement),
        ]);
      case "WhileStatement":
        return concat([
          "while (",
          this.emit(node.expression),
          ") ",
          this.embeddedStatement(node.statement),
        ]);
      case "DoStatement":
        return concat([
          "do ",
          this.embeddedStatement(node.statement),
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
        return this.jumpStatement("break", node.label);
      case "ContinueStatement":
        return this.jumpStatement("continue", node.label);
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
        return concat([
          this.emit(node.label),
          ": ",
          this.embeddedStatement(node.statement),
        ]);
      case "WithStatement":
        return concat([
          "with (",
          this.emit(node.expression),
          ") ",
          this.embeddedStatement(node.statement),
        ]);
      case "DebuggerStatement":
        return "debugger;";
      case "EmptyStatement":
        return ";";

      /* modules & namespaces */
      case "ModuleDeclaration":
        return concat([
          this.modifiers(node.modifiers, true),
          // A string-literal name is always `module "…"`; the flag says nothing
          // there. For an identifier the flag is what chooses, which is the
          // upstream rule and the one `createModuleDeclaration` documents:
          // `namespace A` with `NodeFlags.Namespace`, `module A` without it.
          // The printer used to read the name kind alone, so an identifier
          // always printed `namespace` and the flag it published was inert.
          node.name.kind === "StringLiteral"
            ? "module "
            : node.flags === NodeFlags.Namespace
              ? "namespace "
              : "module ",
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
          this.mappedTypeMembers(node.members),
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
          // An import type spells its attributes as a second call argument —
          // `import("m", { with: { … } }).T` — not as the trailing `with { … }`
          // an import declaration uses, so the elements are wrapped here rather
          // than emitted through the attributes node's own form.
          node.attributes
            ? concat([
                ", ",
                this.withComments(
                  node.attributes,
                  concat([
                    "{ ",
                    node.attributes.token,
                    ": ",
                    this.delim(
                      "{",
                      node.attributes.elements.map((e) => this.emit(e)),
                      "}",
                      {
                        space: true,
                        trailingComma: "onBreak",
                        forceBreak: node.attributes.multiLine === true,
                      },
                    ),
                    " }",
                  ]),
                ),
              ])
            : "",
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
        return concat(["`", templateText(node), "${"]);
      case "TemplateMiddle":
        return concat(["}", templateText(node), "${"]);
      case "TemplateTail":
        return concat(["}", templateText(node), "`"]);
      case "NoSubstitutionTemplateLiteral":
        return concat(["`", templateText(node), "`"]);

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
          this.leftSideExpression(node.tag, false),
          this.typeArguments(node.typeArguments),
          this.emit(node.template),
        ]);
      case "YieldExpression":
        return concat([
          "yield",
          node.asteriskToken ? "*" : "",
          node.expression
            ? concat([
                " ",
                this.restrictedExpression(
                  node.expression,
                  this.expressionForDisallowedComma(node.expression),
                ),
              ])
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
          node.elements.map((e, i) =>
            this.hasOpenLess(e) &&
            node.elements
              .slice(i + 1)
              .some((later) => this.containsClosingOpener(later))
              ? this.parenthesizedExpression(e)
              : this.emit(e),
          ),
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
          {
            space: true,
            trailingComma: this.listTrailingComma(node.elements),
          },
        );
      case "ArrayBindingPattern":
        return this.delim(
          "[",
          node.elements.map((e) => this.emit(e)),
          "]",
          { trailingComma: this.listTrailingComma(node.elements) },
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
          this.leftSideExpression(node.expression, true),
          node.questionDotToken ? "?." : ".",
          this.emit(node.name),
        ]);
      case "ElementAccessChain":
        return concat([
          this.leftSideExpression(node.expression, true),
          node.questionDotToken ? "?." : "",
          "[",
          this.expressionForDisallowedComma(node.argumentExpression),
          "]",
        ]);
      case "CallChain":
        return concat([
          this.leftSideExpression(node.expression, true),
          node.questionDotToken ? "?." : "",
          this.typeArguments(node.typeArguments),
          this.args(node.arguments),
        ]);
      case "NonNullChain":
        return concat([this.leftSideExpression(node.expression, true), "!"]);

      /* jsx */
      case "JsxElement":
        return this.jsxChildren(
          this.emit(node.openingElement),
          node.children,
          this.emit(node.closingElement),
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
        return this.jsxChildren(
          this.emit(node.openingFragment),
          node.children,
          this.emit(node.closingFragment),
        );
      case "JsxOpeningFragment":
        return "<>";
      case "JsxClosingFragment":
        return "</>";
      case "JsxText":
        // the one node emitted as unquoted source text: its trailing spaces are
        // rendered content, so they must survive the layout engine's line trim
        return raw(node.text);
      case "JsxAttribute":
        return node.initializer === undefined
          ? this.emit(node.name)
          : concat([
              this.emit(node.name),
              "=",
              node.initializer.kind === "StringLiteral"
                ? hasLoneSurrogate(node.initializer.text)
                  ? concat(["{", this.emit(node.initializer), "}"])
                  : this.withComments(
                      node.initializer,
                      escapeJsxAttribute(
                        node.initializer.text,
                        node.initializer.singleQuote,
                      ),
                    )
                : this.emit(node.initializer),
            ]);
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
        return this.emit(node.expression, assignmentTarget);
      case "ImportAttribute":
        return concat([this.emit(node.name), ": ", this.emit(node.value)]);
      case "ImportAttributes":
        return concat([
          node.token,
          " ",
          this.delim(
            "{",
            node.elements.map((e) => this.emit(e)),
            "}",
            {
              space: true,
              trailingComma: "onBreak",
              forceBreak: node.multiLine === true,
            },
          ),
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
        // An absent or empty summary writes no line, so a block of tags does
        // not open with a blank ` *` line.
        const lines: Doc[] = [];
        if (typeof node.comment === "string") {
          if (node.comment.length !== 0)
            lines.push(concat([" * ", this.jsDocLines(node.comment)]));
        } else if (node.comment !== undefined && node.comment.length !== 0)
          lines.push(
            concat([
              " * ",
              this.jsDocLines(concat(node.comment.map((c) => this.emit(c)))),
            ]),
          );
        for (const tag of node.tags ?? [])
          lines.push(concat([" * ", this.jsDocLines(this.emit(tag))]));
        return concat([
          "/**",
          hardline,
          ...(lines.length === 0 ? [] : [join(hardline, lines), hardline]),
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
          // `@import { a } from "m" with { type: "json" }` — the same trailing
          // form an import declaration uses, which is why the attributes node
          // emits itself here rather than being unwrapped.
          node.attributes ? concat([" ", this.emit(node.attributes)]) : "",
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
      case "JSDocTypedefTag": {
        // An object-shaped typedef is written as `{Object}` or `{Object[]}`,
        // followed by one line per property tag.
        const literal: JSDocTypeLiteral | undefined =
          node.typeExpression?.kind === "JSDocTypeLiteral"
            ? node.typeExpression
            : undefined;
        return concat([
          "@",
          this.emit(node.tagName),
          literal !== undefined
            ? literal.isArrayType
              ? " {Object[]}"
              : " {Object}"
            : node.typeExpression
              ? concat([" ", this.emit(node.typeExpression)])
              : "",
          node.fullName ? concat([" ", this.emit(node.fullName)]) : "",
          this.jsDocComment(node.comment),
          ...(literal?.jsDocPropertyTags ?? []).map((tag) =>
            concat([hardline, this.emit(tag)]),
          ),
        ]);
      }

      default:
        return this.unsupported(node);
    }
  }

  /**
   * Preserve an existing parenthesis or wrap an expression once.
   *
   * Partial-emission wrappers carry no printed syntax, so an inner explicit
   * parenthesis already supplies the required grammar boundary.
   */
  private parenthesizedExpression(expression: Expression): Doc {
    return this.skipPartiallyEmittedExpressions(expression).kind ===
      "ParenthesizedExpression"
      ? this.emit(expression)
      : concat(["(", this.emit(expression), ")"]);
  }

  /**
   * The partial-emission wrapper carries transform provenance but emits no
   * syntax of its own, so every grammar predicate must inspect its inner node.
   */
  private skipPartiallyEmittedExpressions(expression: Expression): Expression {
    while (expression.kind === "PartiallyEmittedExpression")
      expression = expression.expression;
    return expression;
  }

  private expressionForDisallowedComma(
    expression: Expression,
    assignmentTarget: boolean = false,
  ): Doc {
    return this.expressionPrecedence(expression) > ExpressionPrecedence.Comma
      ? this.emit(expression, assignmentTarget)
      : this.parenthesizedExpression(expression);
  }

  /**
   * Emit an operand the grammar requires to be a `LeftHandSideExpression`,
   * mirroring the legacy parenthesizer's
   * `parenthesizeLeftSideOfAccess(expression, optionalChain)`.
   *
   * `optionalChain` is the **consuming** node's own chain-ness, not the
   * operand's. An optional chain may be emitted bare only when the node
   * consuming it continues the same chain: `a?.b?.()` is one chain, while
   * `(a?.b)()` is a plain call on the chain's value. Emitting the second as
   * `a?.b()` re-parses as the first, which stops throwing on a nullish head,
   * and in `new`, tagged-template and decorator position it does not compile at
   * all.
   */
  private leftSideExpression(
    expression: Expression,
    optionalChain: boolean,
  ): Doc {
    return this.leftSideNeedsParentheses(expression, optionalChain)
      ? this.parenthesizedExpression(expression)
      : this.emit(expression);
  }

  /**
   * Whether {@link leftSideExpression} wraps this operand.
   *
   * The legacy rule also parenthesizes an argument-less `new` here, because it
   * prints `new X` bare and `new X.y` would re-parse with `y` on the target.
   * This printer always emits the argument list, so `new X().y` already says
   * what the tree says and needs no wrapper.
   */
  private leftSideNeedsParentheses(
    expression: Expression,
    optionalChain: boolean,
  ): boolean {
    if (!this.isLeftHandSideExpression(expression)) return true;
    return !optionalChain && this.isOptionalChain(expression);
  }

  private isOptionalChain(expression: Expression): boolean {
    expression = this.skipPartiallyEmittedExpressions(expression);
    switch (expression.kind) {
      case "CallChain":
      case "ElementAccessChain":
      case "NonNullChain":
      case "PropertyAccessChain":
        return true;
      default:
        return false;
    }
  }

  private newExpressionTarget(expression: Expression): Doc {
    return this.newExpressionTargetNeedsParentheses(expression)
      ? this.parenthesizedExpression(expression)
      : this.emit(expression);
  }

  /**
   * Whether a `new` target must be parenthesized to keep its call arguments
   * from re-binding to the `new` — mirroring the legacy printer's
   * `parenthesizeExpressionOfNew`. A `new` target is grammatically a
   * `MemberExpression`, so a call anywhere on the target's printed left spine
   * (not just a direct one: `new (f().bar)()`, `new (a.b().c)()`) would
   * otherwise re-parse with the call's arguments consumed by the `new` — a
   * different program. Argument-less `new` on the spine is kept parenthesized
   * for continuity with the direct case, though this printer always prints an
   * argument list, which already disambiguates it. Anything else falls back to
   * the shared left-side rule, which is what parenthesizes an optional-chain
   * target (`new (a?.b)()`, TS1209 without it).
   */
  private newExpressionTargetNeedsParentheses(expression: Expression): boolean {
    const leftmost: Expression | undefined =
      this.leftmostPrintedExpression(expression);
    if (leftmost !== undefined) {
      if (leftmost.kind === "CallExpression" || leftmost.kind === "CallChain")
        return true;
      if (leftmost.kind === "NewExpression" && leftmost.arguments === undefined)
        return true;
    }
    return this.leftSideNeedsParentheses(expression, false);
  }

  /**
   * The node whose own text opens `expression`'s printed form, or `undefined`
   * when that text opens with a printer-inserted `(`.
   *
   * The legacy factory parenthesizes each operand as it builds the node, so its
   * `getLeftmostExpression` walk halts on the resulting
   * `ParenthesizedExpression`. This printer decides the same parentheses at
   * emit time instead, so the walk has to ask {@link leftSideNeedsParentheses}
   * the same question directly; otherwise `new` re-wraps a target whose call is
   * already behind parentheses, and `new (f?.()).bar()` comes out as `new
   * ((f?.()).bar)()`. Calls halt the walk, matching the legacy
   * `stopAtCallExpressions` mode this predicate is the only user of.
   */
  private leftmostPrintedExpression(
    expression: Expression,
  ): Expression | undefined {
    expression = this.skipPartiallyEmittedExpressions(expression);
    switch (expression.kind) {
      case "CallExpression":
      case "CallChain":
        return expression;
      case "ElementAccessExpression":
      case "NonNullExpression":
      case "PropertyAccessExpression":
        return this.leftmostPrintedLeftSide(expression.expression, false);
      case "ElementAccessChain":
      case "NonNullChain":
      case "PropertyAccessChain":
        return this.leftmostPrintedLeftSide(expression.expression, true);
      case "TaggedTemplateExpression":
        return this.leftmostPrintedLeftSide(expression.tag, false);
      case "AsExpression":
      case "SatisfiesExpression":
        return this.leftmostPrintedExpression(expression.expression);
      case "BinaryExpression":
        return this.leftmostPrintedExpression(expression.left);
      case "ConditionalExpression":
        return this.leftmostPrintedExpression(expression.condition);
      default:
        return expression;
    }
  }

  private leftmostPrintedLeftSide(
    operand: Expression,
    optionalChain: boolean,
  ): Expression | undefined {
    return this.leftSideNeedsParentheses(operand, optionalChain)
      ? undefined
      : this.leftmostPrintedExpression(operand);
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
      ? this.postfixBoundaryOperand(operand, this.emit(operand))
      : this.parenthesizedExpression(operand);
  }

  /** Keep trailing comment line terminators inside a postfix operand's parentheses. */
  private postfixBoundaryOperand(expression: Expression, body: Doc): Doc {
    let last: Node = expression;
    while (true) {
      if (
        getSyntheticTrailingComments(last)?.some(
          (comment) => this.commentHasLineBreak(comment),
        )
      )
        return concat(["(", body, ")"]);
      if (last.kind === "PartiallyEmittedExpression")
        last = last.expression;
      else if (last.kind === "PropertyAccessExpression") last = last.name;
      else if (last.kind === "TaggedTemplateExpression") last = last.template;
      else return body;
    }
  }

  private conditionalCondition(node: ConditionalExpression): Doc {
    const condition: Expression = node.condition;
    // A type followed by `?` can read as a nullable type, which a consequent
    // that does not start a type (`-x`, `--x`) turns into a syntax error. The
    // same reading carries a `<` left open in the condition across the `?` to a
    // `>` in a branch.
    return this.expressionPrecedence(condition) >
      ExpressionPrecedence.Conditional &&
      !this.endsWithTypeAssertion(condition) &&
      !(
        this.hasOpenLess(condition) &&
        (this.containsClosingOpener(node.whenTrue) ||
          this.containsClosingOpener(node.whenFalse))
      )
      ? this.emit(condition)
      : this.parenthesizedExpression(condition);
  }

  /**
   * Whether the printed expression ends with an `as` or `satisfies` type.
   *
   * The walk follows the operand slots the printer writes last and without a
   * delimiter, and skips an operand it parenthesizes.
   */
  private endsWithTypeAssertion(expression: Expression): boolean {
    expression = this.skipPartiallyEmittedExpressions(expression);
    switch (expression.kind) {
      case "AsExpression":
      case "SatisfiesExpression":
        return true;
      case "BinaryExpression":
        return (
          !this.binaryOperandNeedsParentheses(
            expression.operator,
            expression.right,
            false,
            expression.left,
          ) && this.endsWithTypeAssertion(expression.right)
        );
      case "PrefixUnaryExpression":
        return (
          this.isUnaryExpression(expression.operand) &&
          this.endsWithTypeAssertion(expression.operand)
        );
      case "AwaitExpression":
      case "TypeOfExpression":
      case "VoidExpression":
      case "DeleteExpression":
      case "TypeAssertion":
        return (
          this.isUnaryExpression(expression.expression) &&
          this.endsWithTypeAssertion(expression.expression)
        );
      case "ConditionalExpression":
        return (
          this.expressionPrecedence(expression.whenFalse) >
            ExpressionPrecedence.Comma &&
          this.endsWithTypeAssertion(expression.whenFalse)
        );
      case "YieldExpression":
        return (
          expression.expression !== undefined &&
          this.expressionPrecedence(expression.expression) >
            ExpressionPrecedence.Comma &&
          this.endsWithTypeAssertion(expression.expression)
        );
      default:
        return false;
    }
  }

  /**
   * A `? whenTrue` or `: whenFalse` branch. An arrow function whose concise
   * body is itself a parenthesized group is parenthesized when it stands as the
   * consequent, because TypeScript reads `() => (b) : c` as a nested arrow head
   * `(b): c` with a return type.
   */
  private conditionalBranch(branch: Expression, later?: Expression): Doc {
    return later !== undefined &&
      (this.arrowBodyIsGroup(branch) ||
        (this.hasOpenLess(branch) && this.containsClosingOpener(later)))
      ? this.parenthesizedExpression(branch)
      : this.expressionForDisallowedComma(branch);
  }

  private arrowBodyIsGroup(expression: Expression): boolean {
    expression = this.skipPartiallyEmittedExpressions(expression);
    if (expression.kind !== "ArrowFunction" || expression.body.kind === "Block")
      return false;
    return (
      this.skipPartiallyEmittedExpressions(expression.body).kind ===
        "ParenthesizedExpression" ||
      this.expressionNeedsConciseBodyParentheses(expression.body)
    );
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
    assignmentTarget: boolean = false,
    rightOperand?: Expression,
  ): Doc {
    return this.binaryOperandNeedsParentheses(
      operator,
      operand,
      isLeftSide,
      leftOperand,
      rightOperand,
    )
      ? this.parenthesizedExpression(operand)
      : this.emit(operand, assignmentTarget);
  }

  private binaryOperandNeedsParentheses(
    operator: SyntaxKind,
    operand: Expression,
    isLeftSide: boolean,
    leftOperand?: Expression,
    rightOperand?: Expression,
  ): boolean {
    const emittedOperand: Expression =
      this.skipPartiallyEmittedExpressions(operand);
    if (emittedOperand.kind === "ParenthesizedExpression") return false;
    if (
      operator === SyntaxKind.AsteriskAsteriskToken &&
      isLeftSide &&
      this.expressionPrecedence(emittedOperand) === ExpressionPrecedence.Unary
    )
      return true;
    if (
      emittedOperand.kind === "BinaryExpression" &&
      this.mixingBinaryOperatorsRequiresParentheses(
        operator,
        emittedOperand.operator,
      )
    )
      return true;
    // The type after `as` / `satisfies` extends over a following `&` or `|`,
    // and over a `<` that reads as the start of type arguments, so an operand
    // printed as ending in an assertion, on the left of one of these operators,
    // would re-parse with the operator and its right operand inside the type.
    if (
      isLeftSide &&
      (operator === SyntaxKind.AmpersandToken ||
        operator === SyntaxKind.BarToken ||
        operator === SyntaxKind.LessThanToken) &&
      this.endsWithTypeAssertion(emittedOperand)
    )
      return true;
    // `a < b > (c)` can read as the call `a<b>(c)` with type arguments. An
    // operand that leaves a `<` open keeps its own parentheses when a `>` that
    // closes the list follows it, directly or through `|`, `&`, `??` or `,`.
    if (
      isLeftSide &&
      this.hasOpenLess(emittedOperand) &&
      ((isGreaterThanOperator(operator) &&
        rightOperand !== undefined &&
        (this.binaryOperandNeedsParentheses(
          operator,
          rightOperand,
          false,
          emittedOperand,
        ) ||
          this.startsWithOpener(rightOperand))) ||
        (isTypeListConnector(operator) &&
          rightOperand !== undefined &&
          this.containsClosingOpener(rightOperand)))
    )
      return true;

    const operatorPrecedence: ExpressionPrecedence =
      this.binaryOperatorPrecedence(operator);
    const operandPrecedence: ExpressionPrecedence =
      this.expressionPrecedence(emittedOperand);
    if (operandPrecedence < operatorPrecedence) return true;
    if (operandPrecedence > operatorPrecedence) return false;

    if (isLeftSide)
      return this.binaryOperatorAssociativity(operator) === Associativity.Right;
    if (
      emittedOperand.kind === "BinaryExpression" &&
      emittedOperand.operator === operator
    ) {
      if (this.operatorHasAssociativeProperty(operator)) return false;
      if (
        operator === SyntaxKind.PlusToken &&
        leftOperand !== undefined &&
        this.literalKindOfBinaryPlusOperand(leftOperand) !== undefined &&
        this.literalKindOfBinaryPlusOperand(leftOperand) ===
          this.literalKindOfBinaryPlusOperand(emittedOperand)
      )
        return false;
    }
    return this.expressionAssociativity(emittedOperand) === Associativity.Left;
  }

  private expressionPrecedence(expression: Expression): ExpressionPrecedence {
    expression = this.skipPartiallyEmittedExpressions(expression);
    switch (expression.kind) {
      case "CommaListExpression":
        return ExpressionPrecedence.Comma;
      case "YieldExpression":
        return ExpressionPrecedence.Yield;
      case "ArrowFunction":
        return ExpressionPrecedence.Assignment;
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
    expression = this.skipPartiallyEmittedExpressions(expression);
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
      case "ArrowFunction":
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
    // Arithmetic can round, and numeric coercions can have observable effects.
    // Only comma grouping preserves evaluation without knowing operand values.
    return operator === SyntaxKind.CommaToken;
  }

  private literalKindOfBinaryPlusOperand(
    expression: Expression,
  ): string | undefined {
    expression = this.skipPartiallyEmittedExpressions(expression);
    // Literal strings concatenate associatively and BigInts add exactly.
    // Numeric literals still use rounded Number addition.
    switch (expression.kind) {
      case "StringLiteral":
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
    expression = this.skipPartiallyEmittedExpressions(expression);
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
      leftmost.kind === "ClassExpression" ||
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

  /**
   * Walk to the expression's leftmost node — the one that starts its printed
   * text — matching the legacy `getLeftmostExpression`.
   *
   * Used by the statement, concise-body and export-default predicates, which
   * ask only whether the text opens with a `function`, `class` or `{` token.
   * The `new`-target predicate needs the printed left edge instead and uses
   * {@link leftmostPrintedExpression}.
   */
  private leftmostExpression(expression: Expression): Expression {
    expression = this.skipPartiallyEmittedExpressions(expression);
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
      case "CommaListExpression":
        return expression.elements.length === 0
          ? expression
          : this.leftmostExpression(expression.elements[0]!);
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
    operand = this.skipPartiallyEmittedExpressions(operand);
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

  /** Embedded statement slots must remain grammatical when a placeholder emits nothing. */
  private embeddedStatement(statement: Statement): Doc {
    return statement.kind === "NotEmittedStatement"
      ? this.withComments(statement, ";")
      : this.emit(statement);
  }

  /**
   * Whether a statement's printed text ends in an `if` with no `else`.
   *
   * An `else` that follows such a statement binds to that inner `if`, so the
   * enclosing `if` must wrap its consequent in a block to keep its own `else`.
   * The walk follows the statement kinds whose embedded body is the last thing
   * printed. A block, a `do` loop and a placeholder end in a delimiter.
   */
  private endsWithElselessIf(statement: Statement): boolean {
    switch (statement.kind) {
      case "IfStatement":
        return (
          statement.elseStatement === undefined ||
          this.endsWithElselessIf(statement.elseStatement)
        );
      case "WhileStatement":
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement":
      case "WithStatement":
      case "LabeledStatement":
        return this.endsWithElselessIf(statement.statement);
      default:
        return false;
    }
  }

  private variableDeclarationList(
    node: VariableDeclarationList,
    forHeader: boolean,
  ): Doc {
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
        node.declarations.map((d) =>
          this.withComments(d, this.variableDeclaration(d, forHeader)),
        ),
      ),
    ]);
  }

  private variableDeclaration(
    node: VariableDeclaration,
    forHeader: boolean,
  ): Doc {
    return concat([
      this.emit(node.name),
      node.exclamationToken ? "!" : "",
      this.optType(node.type),
      node.initializer
        ? concat([
            " = ",
            forHeader && this.exposesIn(node.initializer)
              ? this.parenthesizedExpression(node.initializer)
              : this.expressionForDisallowedComma(node.initializer),
          ])
        : "",
    ]);
  }

  /**
   * Emit the first clause of a `for (;;)` header.
   *
   * The clause is parsed without the `in` operator, so an `in` that is not
   * inside a bracket or parenthesis would end it and read as the head of a
   * `for...in`. Such an initializer is wrapped, which leaves its value intact.
   */
  private forInitializer(initializer: ForInitializer): Doc {
    if (initializer.kind === "VariableDeclarationList")
      return this.withComments(
        initializer,
        this.variableDeclarationList(initializer, true),
      );
    return this.exposesIn(initializer)
      ? this.parenthesizedExpression(initializer)
      : this.emit(initializer);
  }

  /**
   * Whether the printed expression holds an `in` operator that no bracket,
   * parenthesis or other delimiter encloses, so a `for` header would read it as
   * the start of `for...in`.
   */
  private exposesIn(expression: Expression): boolean {
    return this.exposes(expression, (op) => op === SyntaxKind.InKeyword, true);
  }

  /**
   * Whether anywhere in the printed subtree a `>`, `>>` or `>>>` operator is
   * followed by `(` or a template.
   *
   * TypeScript reads `a < b > (c)` as the call `a<b>(c)` with type arguments:
   * after an expression, a `<` starts a type argument list, the type parser
   * recovers inside parentheses, and a `>` followed by `(`, a template or a line
   * break ends the list. The pairing can cross parentheses, brackets and
   * braces, so the scan covers every printed child.
   */
  private containsClosingOpener(node: unknown): boolean {
    if (typeof node !== "object" || node === null) return false;
    if (Array.isArray(node))
      return node.some((child) => this.containsClosingOpener(child));
    const record = node as Record<string, unknown>;
    if (
      record.kind === "BinaryExpression" &&
      isGreaterThanOperator(record.operator as SyntaxKind) &&
      this.closesTypeList(record as unknown as BinaryExpression)
    )
      return true;
    return Object.keys(record).some(
      (key) => key !== "original" && this.containsClosingOpener(record[key]),
    );
  }

  private closesTypeList(node: BinaryExpression): boolean {
    return (
      this.binaryOperandNeedsParentheses(
        node.operator,
        node.right,
        false,
        node.left,
      ) || this.startsWithOpener(node.right)
    );
  }

  /** Whether the printed text of the expression opens with `(` or a template. */
  private startsWithOpener(expression: Expression): boolean {
    expression = this.skipPartiallyEmittedExpressions(expression);
    switch (expression.kind) {
      case "ParenthesizedExpression":
      case "TemplateExpression":
      case "NoSubstitutionTemplateLiteral":
        return true;
      case "ArrowFunction":
        return (
          (expression.modifiers?.length ?? 0) === 0 &&
          (expression.typeParameters?.length ?? 0) === 0
        );
      case "CommaListExpression":
        return (
          expression.elements.length !== 0 &&
          this.startsWithOpener(expression.elements[0]!)
        );
      case "BinaryExpression":
        return (
          this.binaryOperandNeedsParentheses(
            expression.operator,
            expression.left,
            true,
            undefined,
            expression.right,
          ) || this.startsWithOpener(expression.left)
        );
      case "ConditionalExpression":
        return (
          this.expressionPrecedence(expression.condition) <=
            ExpressionPrecedence.Conditional ||
          this.endsWithTypeAssertion(expression.condition) ||
          this.startsWithOpener(expression.condition)
        );
      case "AsExpression":
      case "SatisfiesExpression":
        return (
          this.expressionPrecedence(expression.expression) <
            ExpressionPrecedence.Relational ||
          this.startsWithOpener(expression.expression)
        );
      case "PostfixUnaryExpression":
        return (
          !this.isLeftHandSideExpression(expression.operand) ||
          this.startsWithOpener(expression.operand)
        );
      case "CallExpression":
      case "PropertyAccessExpression":
      case "ElementAccessExpression":
      case "NonNullExpression":
        return (
          this.leftSideNeedsParentheses(expression.expression, false) ||
          this.startsWithOpener(expression.expression)
        );
      case "CallChain":
      case "PropertyAccessChain":
      case "ElementAccessChain":
      case "NonNullChain":
        return (
          this.leftSideNeedsParentheses(expression.expression, true) ||
          this.startsWithOpener(expression.expression)
        );
      case "TaggedTemplateExpression":
        return (
          this.leftSideNeedsParentheses(expression.tag, false) ||
          this.startsWithOpener(expression.tag)
        );
      default:
        return false;
    }
  }

  /**
   * Whether the printed expression leaves a `<` or `<<` comparison open, with
   * only `|`, `&`, `??` or `,` after it, so that a later `>` operand can close it.
   *
   * TypeScript reads `a < b | c > (d)` and `a < b, c > (d)` as the call
   * `a<b | c>(d)` with type arguments: a `<` after an expression starts a type
   * argument list, and a `>` followed by `(` or a template ends it. An operand
   * of the comparison list that holds such a `<` is parenthesized when a `>`
   * operand follows it.
   */
  private hasOpenLess(expression: Expression): boolean {
    expression = this.skipPartiallyEmittedExpressions(expression);
    if (expression.kind === "CommaListExpression")
      return expression.elements.some((element) => this.hasOpenLess(element));
    if (expression.kind === "SpreadElement")
      return this.hasOpenLess(expression.expression);
    if (expression.kind === "ConditionalExpression")
      return (
        this.expressionPrecedence(expression.whenFalse) >
          ExpressionPrecedence.Comma && this.hasOpenLess(expression.whenFalse)
      );
    if (expression.kind === "ArrowFunction")
      return (
        expression.body.kind !== "Block" &&
        !this.expressionNeedsConciseBodyParentheses(expression.body) &&
        this.hasOpenLess(expression.body)
      );
    if (expression.kind !== "BinaryExpression") return false;
    const operator: SyntaxKind = expression.operator;
    if (
      operator === SyntaxKind.LessThanToken ||
      operator === SyntaxKind.LessThanLessThanToken
    )
      return true;
    return (
      (isTypeListConnector(operator) &&
        !this.binaryOperandNeedsParentheses(
          operator,
          expression.left,
          true,
          undefined,
          expression.right,
        ) &&
        this.hasOpenLess(expression.left)) ||
      (!this.binaryOperandNeedsParentheses(
        operator,
        expression.right,
        false,
        expression.left,
      ) &&
        this.hasOpenLess(expression.right))
    );
  }

  /**
   * Emit one element of an argument, array or comma list, parenthesized when it
   * leaves a `<` open and a later element holds a `>` operator.
   */
  private listElement(
    elements: readonly Expression[],
    index: number,
    assignmentTarget: boolean = false,
  ): Doc {
    const element: Expression = elements[index]!;
    if (
      !this.hasOpenLess(element) ||
      !elements
        .slice(index + 1)
        .some((later) => this.containsClosingOpener(later))
    )
      return this.expressionForDisallowedComma(element, assignmentTarget);
    return element.kind === "SpreadElement"
      ? this.withComments(
          element,
          concat(["...", this.parenthesizedExpression(element.expression)]),
        )
      : this.parenthesizedExpression(element);
  }

  /**
   * The walk behind {@link exposesIn}: whether an operator selected by `hit`
   * sits in the printed expression with no delimiter around it.
   *
   * The walk follows the operand positions the printer writes without a
   * delimiter and skips an operand it parenthesizes. The consequent of a
   * conditional is not followed, because that slot admits `in`. Array literal
   * elements are followed only when `crossArrays` is set.
   */
  private exposes(
    expression: Expression,
    hit: (operator: SyntaxKind) => boolean,
    crossArrays: boolean,
  ): boolean {
    const next = (child: Expression): boolean =>
      this.exposes(child, hit, crossArrays);
    expression = this.skipPartiallyEmittedExpressions(expression);
    switch (expression.kind) {
      case "BinaryExpression":
        return (
          hit(expression.operator) ||
          (!this.binaryOperandNeedsParentheses(
            expression.operator,
            expression.left,
            true,
          ) &&
            next(expression.left)) ||
          (!this.binaryOperandNeedsParentheses(
            expression.operator,
            expression.right,
            false,
            expression.left,
          ) &&
            next(expression.right))
        );
      case "ConditionalExpression":
        return (
          (this.expressionPrecedence(expression.condition) >
            ExpressionPrecedence.Conditional &&
            next(expression.condition)) ||
          (this.expressionPrecedence(expression.whenFalse) >
            ExpressionPrecedence.Comma &&
            next(expression.whenFalse))
        );
      case "CommaListExpression":
        return expression.elements.some((element) => next(element));
      case "ArrayLiteralExpression":
        // The TypeScript parser keeps the no-`in` context inside brackets of
        // an array literal, although ECMAScript lifts it there.
        return (
          crossArrays && expression.elements.some((element) => next(element))
        );
      case "SpreadElement":
        return next(expression.expression);
      case "PropertyAccessExpression":
      case "ElementAccessExpression":
      case "CallExpression":
      case "NonNullExpression":
        return (
          !this.leftSideNeedsParentheses(expression.expression, false) &&
          next(expression.expression)
        );
      case "PropertyAccessChain":
      case "ElementAccessChain":
      case "CallChain":
      case "NonNullChain":
        return (
          !this.leftSideNeedsParentheses(expression.expression, true) &&
          next(expression.expression)
        );
      case "TaggedTemplateExpression":
        return (
          !this.leftSideNeedsParentheses(expression.tag, false) &&
          next(expression.tag)
        );
      case "PostfixUnaryExpression":
        return (
          this.isLeftHandSideExpression(expression.operand) &&
          next(expression.operand)
        );
      case "NewExpression":
        return (
          !this.newExpressionTargetNeedsParentheses(expression.expression) &&
          next(expression.expression)
        );
      case "ArrowFunction":
        return (
          expression.body.kind !== "Block" &&
          !this.expressionNeedsConciseBodyParentheses(expression.body) &&
          next(expression.body)
        );
      case "YieldExpression":
        return (
          expression.expression !== undefined &&
          this.expressionPrecedence(expression.expression) >
            ExpressionPrecedence.Comma &&
          next(expression.expression)
        );
      case "AsExpression":
      case "SatisfiesExpression":
        return (
          this.expressionPrecedence(expression.expression) >=
            ExpressionPrecedence.Relational &&
          next(expression.expression)
        );
      case "PrefixUnaryExpression":
      case "AwaitExpression":
      case "TypeOfExpression":
      case "VoidExpression":
      case "DeleteExpression":
      case "TypeAssertion":
        return (
          this.isUnaryExpression(
            expression.kind === "PrefixUnaryExpression"
              ? expression.operand
              : expression.expression,
          ) &&
          next(
            expression.kind === "PrefixUnaryExpression"
              ? expression.operand
              : expression.expression,
          )
        );
      default:
        return false;
    }
  }

  /**
   * Emit a decorator's expression.
   *
   * The grammar after `@` is narrower than a left-hand-side expression: an
   * element access ends the decorator, so one on the printed left spine needs
   * parentheses around the whole expression.
   */
  private decoratorExpression(expression: Expression): Doc {
    return this.leftSideNeedsParentheses(expression, false) ||
      this.decoratorExposesElementAccess(expression)
      ? this.parenthesizedExpression(expression)
      : this.emit(expression);
  }

  private decoratorExposesElementAccess(expression: Expression): boolean {
    expression = this.skipPartiallyEmittedExpressions(expression);
    let receiver: Expression;
    let optionalChain: boolean;
    switch (expression.kind) {
      case "ElementAccessExpression":
      case "ElementAccessChain":
        return true;
      case "PropertyAccessExpression":
      case "NonNullExpression":
      case "CallExpression":
        receiver = expression.expression;
        optionalChain = false;
        break;
      case "PropertyAccessChain":
      case "NonNullChain":
      case "CallChain":
        receiver = expression.expression;
        optionalChain = true;
        break;
      case "TaggedTemplateExpression":
        receiver = expression.tag;
        optionalChain = false;
        break;
      default:
        return false;
    }
    return (
      !this.leftSideNeedsParentheses(receiver, optionalChain) &&
      this.decoratorExposesElementAccess(receiver)
    );
  }

  /** No-line-terminator expression prefixes must precede the operand's comments. */
  private restrictedExpression(
    expression: Expression,
    body: Doc = this.emit(expression),
  ): Doc {
    let first: Node | undefined = expression;
    while (first !== undefined) {
      if (
        getSyntheticLeadingComments(first)?.some(
          (comment) => this.commentHasLineBreak(comment),
        )
      )
        return concat(["(", body, ")"]);
      switch (first.kind) {
        case "PartiallyEmittedExpression":
        case "AsExpression":
        case "SatisfiesExpression":
        case "NonNullExpression":
        case "PropertyAccessExpression":
        case "ElementAccessExpression":
        case "CallExpression":
          first = first.expression;
          break;
        case "BinaryExpression":
          first = first.left;
          break;
        case "ConditionalExpression":
          first = first.condition;
          break;
        case "PostfixUnaryExpression":
          first = first.operand;
          break;
        case "CommaListExpression":
          first = first.elements[0];
          break;
        case "TaggedTemplateExpression":
          first = first.tag;
          break;
        case "FunctionExpression":
        case "ArrowFunction":
          first = first.modifiers?.[0];
          break;
        default:
          first = undefined;
      }
    }
    return body;
  }

  /** Move a line-breaking label comment before its restricted jump keyword. */
  private jumpStatement(keyword: "break" | "continue", label?: Identifier): Doc {
    if (label === undefined) return keyword + ";";
    if (
      getSyntheticLeadingComments(label)?.some(
        (comment) => this.commentHasLineBreak(comment),
      )
    )
      return this.withComments(
        label,
        concat([keyword, " ", this.emitNode(label, false), ";"]),
      );
    return concat([keyword, " ", this.emit(label), ";"]);
  }

  /** Comment delimiters do not shield contained line terminators from grammar. */
  private commentHasLineBreak(comment: SynthesizedComment): boolean {
    return (
      comment.kind === SyntaxKind.SingleLineCommentTrivia ||
      comment.hasLeadingNewLine === true ||
      comment.hasTrailingNewLine === true ||
      /[\r\n]/.test(comment.text)
    );
  }

  /** Prefix every physical JSDoc content line while retaining layout groups. */
  private jsDocLines(doc: Doc): Doc {
    if (typeof doc === "string")
      return join(
        concat([hardline, " * "]),
        doc.replace(/\r\n?/g, "\n").split("\n"),
      );
    switch (doc.type) {
      case "raw":
        return join(
          concat([hardline, " * "]),
          doc.text.replace(/\r\n?/g, "\n").split("\n").map(raw),
        );
      case "hardline":
        return concat([hardline, " * "]);
      case "line":
      case "softline":
        return concat([doc, ifBreak(" * ")]);
      case "concat":
        return concat(doc.parts.map((part) => this.jsDocLines(part)));
      case "indent":
        return indent(this.jsDocLines(doc.doc));
      case "group":
        return group(this.jsDocLines(doc.doc), doc.break);
      case "ifBreak":
        return ifBreak(this.jsDocLines(doc.broken), this.jsDocLines(doc.flat));
    }
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
    const pending: TypeNode[] = Array.from(types).reverse();
    while (pending.length !== 0) {
      const type: TypeNode = pending.pop()!;
      if (
        ((operator === "|" && type.kind === "UnionTypeNode") ||
          (operator === "&" && type.kind === "IntersectionTypeNode")) &&
        (getSyntheticLeadingComments(type)?.length ?? 0) === 0 &&
        (getSyntheticTrailingComments(type)?.length ?? 0) === 0
      ) {
        for (let i = type.types.length - 1; i >= 0; --i)
          pending.push(type.types[i]!);
      } else flattened.push(type);
    }
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
  /**
   * Options for {@link TsPrinter}.
   *
   * These settings choose source layout. They do not select native filesystem
   * behavior, and the width is measured in JavaScript string units.
   *
   * @evidence contracts/common.md#principled-implementation Three independent optional values represent width, indentation text and newline text; nullish defaulting in the constructor preserves explicitly supplied zero or empty strings.
   * @evidence contracts/common.md#clear-and-simple-design The record exposes the printer's three retained layout settings directly, without native-platform policy or speculative formatting modes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Documented defaults are contract-defined layout choices and are not consumer-specific constants or test-only settings.
   * @evidence contracts/common.md#meaningful-documentation Each separated member documents its default, while type prose identifies layout-only responsibility and width units; presentation follows the documentation skill.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This options record defines layout input values and selects no computation algorithm; the printer operations own document-processing costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The value record coordinates no producers or consumers and defines no result identity or invalidation protocol.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The options value owns no handle, running task or retained-population lifecycle; the printer decides what settings it retains.
   */
  export interface IProps {
    /** Maximum line width before groups break. Defaults to `80`. */
    printWidth?: number;

    /** Indentation unit. Defaults to two spaces. */
    indent?: string;

    /** New line sequence. Defaults to `"\n"` (LineFeed). */
    newLine?: string;
  }
}

/**
 * Source text of a template span: `rawText` verbatim when the author provided
 * one (raw fidelity is theirs to own, mirroring the legacy TypeScript emitter),
 * otherwise the cooked `text` escaped for template context.
 */
const templateText = (node: { text: string; rawText?: string }): string =>
  typeof node.rawText === "string"
    ? node.rawText
    : escapeTemplateText(node.text);

/**
 * Escape cooked text so it re-parses to the same cooked value inside a template
 * literal: backslashes, backticks, and `${` sequences (a `$` not followed by
 * `{` stays literal). CR and CRLF are escaped because the scanner normalizes
 * raw template line terminators to LF; a lone LF is legal template text and
 * stays literal.
 */
const escapeTemplateText = (text: string): string =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/\r\n/g, "\\r\\n")
    .replace(/\r/g, "\\r");

/**
 * Whether a JSX text child means the same thing with a line break and
 * indentation around it.
 *
 * JSX drops a whitespace-only child that contains a newline and trims an edge
 * whose whitespace contains one, so only a child with non-whitespace content
 * and no edge whitespace survives being moved onto its own line. Newlines
 * _inside_ the text are unaffected, because JSX collapses each interior line
 * break to a single space in either layout.
 */
const isBreakSafeJsxText = (text: string): boolean =>
  text.length !== 0 && !/^\s/.test(text) && !/\s$/.test(text);

/**
 * Encode cooked text in a quoted JSX attribute. JSX decodes entities rather
 * than JavaScript escapes, so backslashes remain literal and an ampersand or
 * delimiter must be an entity. Numeric entities keep control characters and
 * line endings out of source layout without normalizing their cooked values.
 * The caller routes unpaired surrogates through a JavaScript expression because
 * the pinned native JSX decoder replaces numeric surrogate entities with U+FFFD.
 * Well-formed pairs pass through as one code point.
 */
const escapeJsxAttribute = (text: string, singleQuote?: boolean): string => {
  const quote = singleQuote === true ? "'" : '"';
  let escaped = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "&") escaped += "&amp;";
    else if (ch === quote) escaped += quote === '"' ? "&quot;" : "&apos;";
    else if (ch === "<") escaped += "&lt;";
    else if (code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029)
      escaped += `&#${code};`;
    else escaped += ch;
  }
  return quote + escaped + quote;
};

/** Code-point iteration joins valid pairs and leaves only unpaired units here. */
const hasLoneSurrogate = (text: string): boolean => {
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) return true;
  }
  return false;
};

/**
 * Escape a string literal's text so the printed program holds the value the AST
 * carries.
 *
 * The old set was the backslash, LF, CR, TAB and the active quote. Everything
 * else was emitted raw, which is three separate hazards rather than a cosmetic
 * gap: a C0 control or DEL lands in the generated file as itself; U+2028 and
 * U+2029 terminate a string literal in any JavaScript engine predating ES2019,
 * so the emitted program does not parse; and a lone surrogate becomes U+FFFD
 * the moment the text is written as UTF-8, so the generated program holds a
 * different string than the caller built.
 *
 * Iterated by code point rather than matched by a pattern. That is what makes
 * the surrogate case fall out instead of needing a rule: a well-formed pair
 * arrives as one two-unit string and passes through, and a lone surrogate
 * arrives as a single unit whose code point is in the surrogate range.
 */
const escapeString = (text: string, singleQuote?: boolean): string => {
  const quote = singleQuote === true ? "'" : '"';
  let escaped = "";
  for (const ch of text) {
    if (ch === "\\") {
      escaped += "\\\\";
      continue;
    }
    if (ch === quote) {
      escaped += "\\" + ch;
      continue;
    }
    // The inactive quote is ordinary text and stays as written.
    const code = ch.codePointAt(0) ?? 0;
    const lone = code >= 0xd800 && code <= 0xdfff;
    if (
      ch.length === 2 ||
      (code >= 0x20 &&
        code !== 0x7f &&
        code !== 0x2028 &&
        code !== 0x2029 &&
        !lone)
    ) {
      escaped += ch;
      continue;
    }
    switch (code) {
      case 0x08:
        escaped += "\\b";
        continue;
      case 0x09:
        escaped += "\\t";
        continue;
      case 0x0a:
        escaped += "\\n";
        continue;
      case 0x0b:
        escaped += "\\v";
        continue;
      case 0x0c:
        escaped += "\\f";
        continue;
      case 0x0d:
        escaped += "\\r";
        continue;
      default:
        break;
    }
    escaped +=
      code > 0xff
        ? "\\u" + code.toString(16).padStart(4, "0")
        : "\\x" + code.toString(16).padStart(2, "0");
  }
  return `${quote}${escaped}${quote}`;
};

/** `>`, `>>` and `>>>`, the operators that can close a `<` type list. */
const isGreaterThanOperator = (operator: SyntaxKind): boolean =>
  operator === SyntaxKind.GreaterThanToken ||
  operator === SyntaxKind.GreaterThanGreaterThanToken ||
  operator === SyntaxKind.GreaterThanGreaterThanGreaterThanToken;

/**
 * The operators a type list can hold between its entries and operands. `??`
 * belongs here because the type parser reads `?` as a nullable suffix, and `in`
 * because it reads `K in T` as a mapped type key.
 */
const isTypeListConnector = (operator: SyntaxKind): boolean =>
  operator === SyntaxKind.BarToken ||
  operator === SyntaxKind.AmpersandToken ||
  operator === SyntaxKind.CommaToken ||
  operator === SyntaxKind.QuestionQuestionToken ||
  operator === SyntaxKind.InKeyword ||
  operator === SyntaxKind.InstanceOfKeyword;

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

/**
 * Whether a delimited list may end with a comma, and in which layout.
 *
 * `"onBreak"` is the cosmetic default: the comma appears only when the group
 * breaks. `"always"` and `"never"` are for the lists where the comma is part of
 * the program rather than its layout.
 */
type TrailingComma = "never" | "onBreak" | "always";

const Associativity = {
  Left: "left",
  Right: "right",
} as const;

type Associativity = (typeof Associativity)[keyof typeof Associativity];
