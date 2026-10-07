// @ttsc-corpus-clean: tanstack-query/stable-query-client
import { QueryClient } from "@tanstack/react-query"; const client = new QueryClient(); export function TodosProvider() { return client; }
