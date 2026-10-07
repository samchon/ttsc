import { useQuery } from "@tanstack/react-query";

export function Todos() {
  // expect: tanstack-query/no-rest-destructuring error
  const { data, ...rest } = useQuery({
    queryKey: ["todos"],
    queryFn: () => ["todo"],
  });
  return data ?? rest.status;
}
