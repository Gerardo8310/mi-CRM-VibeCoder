"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  // Se lanza en build/runtime si falta configurar Convex — mejor fallar temprano
  // y con un mensaje claro que dejar que `ConvexReactClient` falle en silencio.
  throw new Error(
    "Falta la variable de entorno NEXT_PUBLIC_CONVEX_URL. Corre `npx convex dev` y copia la URL generada a tu archivo .env.local (ver .env.example)."
  );
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
