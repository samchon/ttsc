export interface ISale {
  price: number;
}
/** @evidence docs/spec.md#sale-price The contract mirrors this pricing rule. */
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
