package evidence

const classContractSource = `
export class Sale {
  static readonly currency: string = "KRW";
  readonly price: number = 0;
  private secret: number = 0;
  protected internal: number = 0;
  #hidden: number = 0;
  [key: string]: unknown;
  static {}
  constructor(count: number) {
    this.price = count;
  }
  charge(): void {}
  static create(): Sale {
    return new Sale(0);
  }
}
`
