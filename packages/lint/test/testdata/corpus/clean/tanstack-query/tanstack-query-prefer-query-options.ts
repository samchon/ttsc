// @ttsc-corpus-clean: tanstack-query/prefer-query-options
import { useQuery } from "@tanstack/react-query"; const options = { queryKey: ["todos"], queryFn: () => ["todo"] }; export function Todos() { return useQuery(options); }
