import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";

/**
 * Mocks minimaux de Next.js : les composants testés n'ont pas de routeur
 * App Router sous eux. `useRouter` renvoie des espions (accessibles via
 * `routerMock` pour les assertions), `usePathname`/`useSearchParams` sont
 * pilotables via `pathnameMock` / `searchParamsMock`.
 */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};
export const pathnameMock = { current: "/" };
export const searchParamsMock = { current: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => pathnameMock.current,
  useSearchParams: () => searchParamsMock.current,
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

// `window.matchMedia` n'existe pas dans jsdom (ThemeContext l'utilise).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  pathnameMock.current = "/";
  searchParamsMock.current = new URLSearchParams();
});
