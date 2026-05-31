package linthost

import "testing"

// TestCommandFormatWrappedFunctionBodyIndent pins the indentation of a function
// or arrow EXPRESSION whose header was pushed onto a continuation line by a
// broken initializer. Prettier indents the body relative to the continuation
// header (one level past the `function`/arrow column), not the statement base.
// format/indent must cede such a body instead of de-indenting it to the
// block-depth column.
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
