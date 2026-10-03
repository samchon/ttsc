// @ttsc-corpus-clean: tanstack-query/no-rest-destructuring
import { useQuery } from "@tanstack/react-query"; export function Todos() { const { data } = useQuery({ queryKey: ["todos"], queryFn: () => ["todo"] }); return data; }
