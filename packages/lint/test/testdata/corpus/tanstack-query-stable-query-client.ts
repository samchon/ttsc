import { QueryClient } from "@tanstack/react-query";

export function TodosProvider() {
  // expect: tanstack-query/stable-query-client error
  const client = new QueryClient();
  return client;
}
