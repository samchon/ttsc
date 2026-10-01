import * as React from "react";
import { useQuery } from "@tanstack/react-query";

export function Todos() {
  const result = useQuery({
    queryKey: ["todos"],
    queryFn: () => ["todo"],
  });
  // expect: tanstack-query/no-unstable-deps error
  React.useEffect(() => {}, [result]);
  return result.data;
}
