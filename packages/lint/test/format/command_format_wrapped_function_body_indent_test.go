package linthost

import "testing"

// TestCommandFormatWrappedFunctionBodyIndent pins the indentation of a function
// or arrow EXPRESSION whose header was pushed onto a continuation line by a
// broken initializer. Prettier indents the body relative to the continuation
// header (one level past the `function`/arrow column), not the statement base.
// format/indent must cede such a body instead of de-indenting it to the
// block-depth column.
//
//  1. Exercise the authored command format wrapped function body indent fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises wrapped function body indent and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: wrapped_function_expression_body, inline_arrow_body_unchanged. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatWrappedFunctionBodyIndent owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
