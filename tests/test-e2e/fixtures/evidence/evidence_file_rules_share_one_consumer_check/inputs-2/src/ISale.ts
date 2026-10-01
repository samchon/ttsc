/** A sale offered to a customer. */
export interface ISale {
  price: number;
}

export function total(sale: ISale): number {
  return sale.price;
}
