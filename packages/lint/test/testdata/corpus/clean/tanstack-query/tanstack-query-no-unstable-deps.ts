// @ttsc-corpus-clean: tanstack-query/no-unstable-deps
import * as React from "react"; import { useQuery } from "@tanstack/react-query"; export function Todos() { const result = useQuery({ queryKey: ["todos"], queryFn: () => ["todo"] }); React.useEffect(() => {}, [result.data]); return result.data; }
