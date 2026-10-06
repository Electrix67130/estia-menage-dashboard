import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/** QueryClient de test : pas de retry (les erreurs remontent tout de suite), pas de cache résiduel. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function createQueryWrapper(qc = createTestQueryClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, Wrapper };
}

export function renderWithQuery(ui: ReactElement, options?: RenderOptions) {
  const { qc, Wrapper } = createQueryWrapper();
  return { qc, ...render(ui, { wrapper: Wrapper, ...options }) };
}
