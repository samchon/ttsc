package linthost

import "testing"

// TestCommandFormatWrappedFunctionBodyIndent pins the indentation of a function
// or arrow EXPRESSION whose header was pushed onto a continuation line by a
// broken initializer. The authored wrapped-function expectation indents the
// body one level past the continuation header rather than the statement base.
// format/indent must cede such a body instead of de-indenting it to the
// block-depth column.
//
//  1. Seed a function expression wrapped onto a continuation line and a same-line arrow initializer.
//  2. Run `ttsc format` with the default format block on each.
//  3. Require both files byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Two subcases run the in-process `format` command on authored layouts and require each unchanged: a function expression whose header is wrapped onto a continuation line after a long typed initializer, with its body one level past that header, and an arrow initializer on the same line with an ordinary body.
// @evidence contracts/testing.md#independent-expectations Complete authored sources preserve the exported binding, function name, parameter union/function/optional types, return type, wrapHandler assignment and listener-call operands; the inline arrow preserves its binding and call. Expectations are independent of formatter output, without an external formatter invocation.
// @evidence contracts/testing.md#distinguishing-cases The wrapped case (body depth differs from block depth) is paired with the unaffected inline arrow; a formatter that de-indented the wrapped body to block depth would fail. Both are fixed points.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatWrappedFunctionBodyIndent(t *testing.T) {
  // Named function expression on a continuation line: body at +4 (header +2).
  t.Run("wrapped_function_expression_body", func(t *testing.T) {
    assertFormatUnchanged(t, `export const addStandardDisposableListener: IAddStandardDisposableListenerSignature =
  function addStandardDisposableListener(
    node: HTMLElement | Element | Document,
    type: string,
    handler: (event: any) => void,
    useCapture?: boolean,
  ): IDisposable {
    let wrapHandler = handler;

    return addDisposableListener(node, type, wrapHandler, useCapture);
  };
`)
  })
  // A same-line arrow initializer is unaffected (body at the ordinary +1).
  t.Run("inline_arrow_body_unchanged", func(t *testing.T) {
    assertFormatUnchanged(t, `const f = () => {
  doThing();
};
`)
  })
}
