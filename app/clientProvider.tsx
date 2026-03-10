"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const RootProvider = dynamic(
  () => import("./rootProvider").then((m) => ({ default: m.RootProvider })),
  { ssr: false, loading: () => null }
);

export function ClientProvider({ children }: { children: ReactNode }) {
  return <RootProvider>{children}</RootProvider>;
}
