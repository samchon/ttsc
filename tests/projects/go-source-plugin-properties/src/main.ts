interface User {
  id: number;
  email: string;
  name: string;
}

interface Product {
  sku: string;
  price: number;
}

export const userProps: readonly string[] = typeProperties<User>();
export const productProps: readonly string[] = typeProperties<Product>();
console.log(userProps, productProps);
