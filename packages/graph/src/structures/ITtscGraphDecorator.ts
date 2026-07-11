/**
 * A decorator as written on a declaration, carried on the decorated
 * {@link ITtscGraphNode}'s `decorators`. Reported faithfully, not interpreted
 * per framework: `name` is the decorator as written (`Controller`, `Get`,
 * `TypedRoute.Get`, ...), and statically resolvable literal arguments are
 * preserved so a consumer applies its own meaning without re-parsing source.
 */
export interface ITtscGraphDecorator {
  /**
   * The decorator name as written, qualified through its access path:
   * `Controller`, `Get`, `TypedRoute.Get`, `MessagePattern`.
   */
  name: string;

  /** The literal call arguments, in source order. Empty for a bare decorator. */
  arguments: ITtscGraphDecorator.IArgument[];
}
export namespace ITtscGraphDecorator {
  /**
   * One argument of an {@link ITtscGraphDecorator}. `literal` is set only when
   * the argument is a string, number, or boolean literal the producer could
   * resolve statically, so a consumer can use it without evaluating code.
   */
  export interface IArgument {
    /** The statically-resolved literal value, when the argument is a literal. */
    literal?: string | number | boolean;
  }
}
