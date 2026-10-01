/** A sale offered to a customer. */
export class Sale {
  /** The amount the customer pays. */
  public readonly price: number = 0;
}

/** A plain contract no class merges with. */
export interface IPlain {
  /** The rate this contract fixes. */
  rate: number;
}
