// @ttsc-corpus-clean: tanstack-query/no-void-query-fn
import { useQuery } from "@tanstack/react-query"; export function useTodos() { return useQuery({ queryKey: ["todos"], queryFn: () => { return ["todo"]; } }); }
