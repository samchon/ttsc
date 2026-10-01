/** @evidence docs/subject.md#sale The sale this section specifies. */
export class Sale {
  /** @evidence docs/fields.md#price The price this section fixes. */
  public readonly price: number = 0;
  private ledger: number = 0;
  public charge(): void {}
}
