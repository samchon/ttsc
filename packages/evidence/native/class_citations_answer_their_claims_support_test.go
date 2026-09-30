package evidence

const classTypeClaimConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"type",
  "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
}]}`

const classMemberReferenceConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/ledger.ts"],
  "symbol":"type",
  "reference":{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":["function","property"]
  }
}]}`

const classMemberReferenceSource = `
export class Sale {
  readonly price: number = 0;
  static readonly currency: string = "KRW";
  charge(): void {}
  static create(): Sale {
    return new Sale();
  }
}
`
