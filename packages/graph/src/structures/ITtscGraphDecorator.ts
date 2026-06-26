/**
 * A decorator as written on a declaration, carried on the decorated
 * {@link ITtscGraphNode}'s `decorators`. The graph reports the decorator
 * faithfully rather than interpreting any framework's convention: the `name` is
 * the decorator as written (`Controller`, `Get`, `TypedRoute.Get`, …) and the
 * statically resolvable `arguments` are preserved, so a consumer can apply its
 * own meaning without re-parsing source.
 */
export interface ITtscGraphDecorator {
  /**
   * The decorator name as written, qualified through its access path —
   * `Controller`, `Get`, `TypedRoute.Get`, `MessagePattern`.
   */
  name: string;

  /** The call arguments, in source order. Empty for a bare decorator. */
  arguments: ITtscGraphDecorator.IArgument[];
}
export namespace ITtscGraphDecorator {
  /**
   * One argument of an {@link ITtscGraphDecorator}. `text` is always the source
   * of the argument expression; `literal` is set only when the argument is a
   * string, number, or boolean literal the producer could resolve statically,
   * so a consumer can use it without evaluating code.
   */
  export interface IArgument {
    /** The argument expression's source text. */
    text: string;

    /** The statically-resolved literal value, when the argument is a literal. */
    literal?: string | number | boolean;
  }
}
