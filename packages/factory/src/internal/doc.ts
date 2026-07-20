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
 * @author Jeongho Nam - https://github.com/samchon
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

/** Concatenate documents. */
export const concat = (parts: Doc[]): Doc => ({ type: "concat", parts });
/**
 * Literal text whose trailing whitespace is content, not layout.
 *
 * {@link printDocToString} strips spaces and tabs from the end of a line before
 * writing a newline, which is right for generated code and wrong for the one
 * node emitted as unquoted source text, `JsxText`: a trimmed trailing space
 * there deletes a JSX separator and changes what the component renders. Text
 * emitted through this node is never trimmed.
 */
export const raw = (text: string): Doc => ({ type: "raw", text });
/** A group: printed flat when it fits, broken otherwise. */
export const group = (doc: Doc, shouldBreak: boolean = false): Doc => ({
  type: "group",
  doc,
  break: shouldBreak,
});
/** Increase indentation of the inner document by one level. */
export const indent = (doc: Doc): Doc => ({ type: "indent", doc });
/** A space when flat, a newline when broken. */
export const line: Doc = { type: "line" };
/** Nothing when flat, a newline when broken. */
export const softline: Doc = { type: "softline" };
/** Always a newline; forces every enclosing group to break. */
export const hardline: Doc = { type: "hardline" };
/** Print `broken` when the enclosing group breaks, `flat` otherwise. */
export const ifBreak = (broken: Doc, flat: Doc = ""): Doc => ({
  type: "ifBreak",
  broken,
  flat,
});
/** Interleave `items` with `separator`. */
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

/** Options for {@link printDocToString}. */
export interface PrintDocOptions {
  printWidth: number;
  newLine: string;
  indent: string;
}

/** Lay a {@link Doc} out into source text. */
export const printDocToString = (
  doc: Doc,
  options: PrintDocOptions,
): string => {
  propagateBreaks(doc);
  const { printWidth, newLine, indent: tab } = options;
  const out: string[] = [];
  let pos = 0;
  // whether the tail of `out` is raw text, whose trailing whitespace is content
  let rawTail = false;
  const cmds: Cmd[] = [[0, MODE_BREAK, doc]];
  const newlineTo = (ind: number): void => {
    if (out.length && !rawTail)
      out[out.length - 1] = out[out.length - 1]!.replace(/[ \t]+$/, "");
    out.push(newLine + tab.repeat(ind));
    pos = tab.length * ind;
    rawTail = false;
  };
  while (cmds.length) {
    const [ind, mode, d] = cmds.pop()!;
    if (typeof d === "string") {
      // an empty string contributes nothing but would become the tail that
      // `newlineTo` trims, hiding the real end of the line behind it
      if (d.length !== 0) {
        out.push(d);
        pos += d.length;
        rawTail = false;
      }
      continue;
    }
    switch (d.type) {
      case "raw":
        out.push(d.text);
        pos += d.text.length;
        rawTail = true;
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
