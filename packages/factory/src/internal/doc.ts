/**
 * Internal Wadler/Prettier-style pretty-printing engine.
 *
 * {@link TsPrinter} builds a {@link Doc} (an intermediate representation) per
 * node instead of concatenating strings, then {@link printDocToString} lays it
 * out against a print width: each {@link group} prints flat when it fits on the
 * current line and breaks otherwise — the same algorithm Prettier uses.
 *
 * This module is internal; it is not part of the public `@ttsc/factory` API.
 *
 * Strings are ordinary source fragments. Raw fragments preserve content
 * whitespace; concat preserves order; indent changes nesting; groups and
 * ifBreak choose layout. Line nodes distinguish spaces, optional breaks and
 * mandatory breaks. Group break flags are mutable during layout propagation.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The discriminated union separates literal source from layout instructions; each variant carries exactly the children or alternatives needed by the document interpreter, including raw text whose whitespace is meaningful.
 * @evidence contracts/common.md#clear-and-simple-design A compact recursive document language keeps syntax emission independent of width layout; group state is explicit instead of hidden in printer-global flags.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Raw fragments and line modes represent source semantics and layout obligations directly, without fixture-dependent instructions or an external formatter patch.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe internal ownership, instruction meanings and mutable break propagation, using the documentation skill's distinct-idea separation before tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 */
export type Doc =
  | string
  | { type: "raw"; text: string }
  | { type: "concat"; parts: Doc[] }
  | { type: "line" }
  | { type: "softline" }
  | { type: "hardline" }
  | { type: "indent"; doc: Doc }
  | { type: "group"; doc: Doc; break: boolean }
  | { type: "ifBreak"; broken: Doc; flat: Doc };

/**
 * Concatenate documents in their supplied order.
 *
 * The parts array is retained by reference; callers own its later mutation.
 *
 * @evidence contracts/common.md#principled-implementation The concat instruction preserves ordered child documents for later interpretation without prematurely flattening their layout decisions.
 * @evidence contracts/common.md#clear-and-simple-design One instruction record expresses ordered composition; flattening belongs to the document interpreter rather than this builder.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The result represents every supplied part uniformly and introduces no answer-specific literal or patched formatter state.
 * @evidence contracts/common.md#meaningful-documentation Prose states ordering and retained-array ownership in separate paragraphs before tags, following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned document belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one document record in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh document; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory document construction; no filesystem, path or process boundary.
 */
export const concat = (parts: Doc[]): Doc => ({ type: "concat", parts });
/**
 * Literal text whose trailing whitespace is content, not layout.
 *
 * {@link printDocToString} strips spaces and tabs from the end of a line before
 * writing a newline, which is right for generated code and wrong for the one
 * node emitted as unquoted source text, `JsxText`: a trimmed trailing space
 * there deletes a JSX separator and changes what the component renders. Text
 * emitted through this node is never trimmed.
 *
 * @evidence contracts/common.md#principled-implementation A distinct raw instruction prevents layout's trailing-space normalization from deleting source content, while retaining the supplied text verbatim.
 * @evidence contracts/common.md#clear-and-simple-design Rawness is one explicit instruction kind interpreted at the shared layout boundary, not an independent JSX formatter pipeline.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The raw branch preserves the supported JSX text contract for arbitrary content; it is not a fixture-specific whitespace exception.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why unquoted JSX whitespace differs from ordinary layout, with a blank comment line before tags as required by the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned document belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one document record in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh document; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory document construction; no filesystem, path or process boundary.
 */
export const raw = (text: string): Doc => ({ type: "raw", text });
/**
 * A group: printed flat when it fits, broken otherwise.
 *
 * `shouldBreak` forces this group's broken form. Layout may also set its break
 * flag when a contained mandatory line requires surrounding groups to break.
 *
 * @evidence contracts/common.md#principled-implementation The group record couples a document with an explicit break requirement; the interpreter tests flat width only when no required break rules it out.
 * @evidence contracts/common.md#clear-and-simple-design One group instruction carries its child and break flag, leaving fit analysis and inherited break propagation to the layout owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Forced breaks are explicit caller layout intent, not consumer names or patched external printer behavior.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains fit behavior and mutable forced-break propagation in separate paragraphs before tags, applying the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned document belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one document record in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh document; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory document construction; no filesystem, path or process boundary.
 */
export const group = (doc: Doc, shouldBreak: boolean = false): Doc => ({
  type: "group",
  doc,
  break: shouldBreak,
});
/**
 * Increase indentation of the inner document by one level.
 *
 * Indentation is applied after line breaks; the instruction does not prefix
 * spaces onto text that remains on the current line.
 *
 * @evidence contracts/common.md#principled-implementation The indent instruction changes the interpreter's nesting count while preserving the child document, so only broken line indentation gains one configured unit.
 * @evidence contracts/common.md#clear-and-simple-design Nesting is represented by one wrapper instead of precomputed whitespace duplicated through each child.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The extra level uses the configured indentation unit uniformly and does not special-case generated names or expected output.
 * @evidence contracts/common.md#meaningful-documentation The comment distinguishes line-break indentation from inline text padding, with separate paragraphs and native tags under the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned document belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one document record in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh document; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory document construction; no filesystem, path or process boundary.
 */
export const indent = (doc: Doc): Doc => ({ type: "indent", doc });
/** A space when flat, a newline when broken. */
export const line: Doc = { type: "line" };
/** Nothing when flat, a newline when broken. */
export const softline: Doc = { type: "softline" };
/** Always a newline; forces every enclosing group to break. */
export const hardline: Doc = { type: "hardline" };
/**
 * Print `broken` when the enclosing group breaks, `flat` otherwise.
 *
 * An omitted flat alternative emits no text. Both alternatives remain document
 * instructions, so their own nesting and line modes are interpreted normally.
 *
 * @evidence contracts/common.md#principled-implementation The instruction stores both layout alternatives and selects by the active interpreter mode; the empty-string default expresses omission in flat layout.
 * @evidence contracts/common.md#clear-and-simple-design A single conditional instruction keeps width-dependent alternatives adjacent without duplicating the surrounding document structure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Mode selection implements an explicit layout decision and does not infer behavior from consumer identity or rewrite foreign state.
 * @evidence contracts/common.md#meaningful-documentation Prose explains the empty default and nested instruction interpretation in separate paragraphs, following the documentation skill's useful detail and tag separation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned document belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one document record in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh document; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory document construction; no filesystem, path or process boundary.
 */
export const ifBreak = (broken: Doc, flat: Doc = ""): Doc => ({
  type: "ifBreak",
  broken,
  flat,
});
/**
 * Interleave `items` with `separator`, preserving item order.
 *
 * Separators occur only between adjacent items. An empty list has no output,
 * and a single item receives no separator.
 *
 * @evidence contracts/common.md#principled-implementation The traversal adds a separator precisely when an item has a predecessor; the resulting ordered concat therefore has no leading or trailing separator.
 * @evidence contracts/common.md#clear-and-simple-design One shared interleaving operation owns sequence punctuation for printer lists, with composition delegated to concat.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty and singleton behavior follows the generic adjacency rule rather than example-specific output branches.
 * @evidence contracts/common.md#meaningful-documentation Native prose states ordering and separator boundaries, with separate paragraphs before acknowledgments as required by the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned document belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One linear pass over the items; interleaving has no alternative algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh document; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory document construction; no filesystem, path or process boundary.
 */
export const join = (separator: Doc, items: Doc[]): Doc => {
  const parts: Doc[] = [];
  items.forEach((item, i) => {
    if (i !== 0) parts.push(separator);
    parts.push(item);
  });
  return concat(parts);
};

const MODE_BREAK = 1;
const MODE_FLAT = 2;
type Cmd = [number, number, Doc];

/** Mark every group that (transitively) contains a hardline as broken. */
const propagateBreaks = (doc: Doc): boolean => {
  if (typeof doc === "string") return false;
  switch (doc.type) {
    case "concat": {
      let broke = false;
      for (const part of doc.parts) broke = propagateBreaks(part) || broke;
      return broke;
    }
    case "indent":
      return propagateBreaks(doc.doc);
    case "group": {
      const broke = propagateBreaks(doc.doc);
      doc.break = doc.break || broke;
      return doc.break;
    }
    case "ifBreak":
      propagateBreaks(doc.broken);
      propagateBreaks(doc.flat);
      return false;
    case "hardline":
      return true;
    default:
      return false;
  }
};

/** Does `next` (followed by `rest`) fit flat within `remaining` columns? */
const fits = (next: Cmd, rest: readonly Cmd[], remaining: number): boolean => {
  let width = remaining;
  const cmds: Cmd[] = [next];
  let restIndex = rest.length;
  while (width >= 0) {
    if (cmds.length === 0) {
      if (restIndex === 0) return true;
      cmds.push(rest[--restIndex]!);
      continue;
    }
    const [ind, mode, doc] = cmds.pop()!;
    if (typeof doc === "string") {
      width -= doc.length;
      continue;
    }
    switch (doc.type) {
      case "raw":
        width -= doc.text.length;
        break;
      case "concat":
        for (let i = doc.parts.length - 1; i >= 0; i--)
          cmds.push([ind, mode, doc.parts[i]!]);
        break;
      case "indent":
        cmds.push([ind + 1, mode, doc.doc]);
        break;
      case "group":
        cmds.push([ind, doc.break ? MODE_BREAK : mode, doc.doc]);
        break;
      case "ifBreak":
        cmds.push([ind, mode, mode === MODE_BREAK ? doc.broken : doc.flat]);
        break;
      case "line":
        if (mode === MODE_FLAT) width -= 1;
        else return true;
        break;
      case "softline":
        if (mode !== MODE_FLAT) return true;
        break;
      case "hardline":
        return true;
    }
  }
  return false;
};

/**
 * Layout settings for {@link printDocToString}.
 *
 * Width measures JavaScript string units. Newline and indentation are source
 * text choices; this interpreter does not discover native platform policy.
 *
 * @evidence contracts/common.md#principled-implementation The record supplies the width budget and two literal layout strings consumed by the interpreter; it does not imply a visual-column measurement or native newline discovery.
 * @evidence contracts/common.md#clear-and-simple-design The three settings match the document interpreter's actual inputs directly, without optional policy layers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit caller settings determine layout uniformly; the type carries no fixture mode or platform-name shortcut.
 * @evidence contracts/common.md#meaningful-documentation Type prose and separated member comments explain units and literal string responsibilities, applying the documentation skill's clarity and member separation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 */
export interface PrintDocOptions {
  /** String-unit budget for choosing flat group layout. */
  printWidth: number;

  /** Literal sequence emitted at each layout line break. */
  newLine: string;

  /** Literal indentation unit repeated once per nesting level. */
  indent: string;
}

/**
 * Lay a {@link Doc} out into source text.
 *
 * Mandatory lines propagate break flags into groups before interpretation.
 * These flags remain on the supplied document after the call. Ordinary text
 * loses trailing spaces at layout line breaks; raw text retains them.
 *
 * @evidence contracts/common.md#principled-implementation Break propagation establishes required group modes before the explicit command stack interprets ordered documents; fits checks the remaining line budget and the last raw fragment bounds trimming of later layout whitespace. Inputs must be acyclic documents.
 * @evidence contracts/common.md#clear-and-simple-design Propagation, fit lookahead and output interpretation have separate helpers over one document language; all width and indentation state is local to a call.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Raw-fragment preservation implements literal-source meaning through an explicit instruction; no expected-output lookup or patched formatter decides breaks.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs identify persistent group-flag mutation and ordinary versus raw whitespace effects, with prose and tags separated under the documentation skill.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The command stack and output fragments are local to the call and released on return; the only retained effect is the break flag set on groups of the supplied document.
 * @evidence contracts/performance.md#efficient-algorithms Layout is one pass over an explicit command stack with break propagation visiting each node once; each group fit check scans ahead to the first line break in break mode, so a long run without breaks can cost more than linear.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work One synchronous layout of the caller's document; nothing is shared across calls.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation String layout over an in-memory document; the newline text is an option and no filesystem or process boundary is touched.
 */
export const printDocToString = (
  doc: Doc,
  options: PrintDocOptions,
): string => {
  propagateBreaks(doc);
  const { printWidth, newLine, indent: tab } = options;
  const out: string[] = [];
  let pos = 0;
  // Layout whitespace after this fragment may be trimmed, but raw content may not.
  let lastRawIndex = -1;
  const cmds: Cmd[] = [[0, MODE_BREAK, doc]];
  const newlineTo = (ind: number): void => {
    while (out.length - 1 > lastRawIndex) {
      const last = out[out.length - 1]!.replace(/[ \t]+$/, "");
      if (last.length !== 0) {
        out[out.length - 1] = last;
        break;
      }
      out.pop();
    }
    out.push(newLine + tab.repeat(ind));
    pos = tab.length * ind;
    lastRawIndex = -1;
  };
  while (cmds.length) {
    const [ind, mode, d] = cmds.pop()!;
    if (typeof d === "string") {
      // an empty string contributes nothing but would become the tail that
      // `newlineTo` trims, hiding the real end of the line behind it
      if (d.length !== 0) {
        out.push(d);
        pos += d.length;
      }
      continue;
    }
    switch (d.type) {
      case "raw":
        if (d.text.length !== 0) {
          out.push(d.text);
          pos += d.text.length;
          lastRawIndex = out.length - 1;
        }
        break;
      case "concat":
        for (let i = d.parts.length - 1; i >= 0; i--)
          cmds.push([ind, mode, d.parts[i]!]);
        break;
      case "indent":
        cmds.push([ind + 1, mode, d.doc]);
        break;
      case "group":
        if (mode === MODE_FLAT && !d.break) cmds.push([ind, MODE_FLAT, d.doc]);
        else if (
          !d.break &&
          fits([ind, MODE_FLAT, d.doc], cmds, printWidth - pos)
        )
          cmds.push([ind, MODE_FLAT, d.doc]);
        else cmds.push([ind, MODE_BREAK, d.doc]);
        break;
      case "ifBreak":
        cmds.push([ind, mode, mode === MODE_BREAK ? d.broken : d.flat]);
        break;
      case "line":
        if (mode === MODE_FLAT) {
          out.push(" ");
          pos += 1;
        } else newlineTo(ind);
        break;
      case "softline":
        if (mode !== MODE_FLAT) newlineTo(ind);
        break;
      case "hardline":
        newlineTo(ind);
        break;
    }
  }
  return out.join("");
};
