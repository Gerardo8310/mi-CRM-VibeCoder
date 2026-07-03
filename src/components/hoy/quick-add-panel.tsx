"use client";

import { QuickAddClient } from "@/components/hoy/quick-add-client";
import { QuickAddSale } from "@/components/hoy/quick-add-sale";
import { QuickAddInteraction } from "@/components/hoy/quick-add-interaction";

/**
 * Los tres accesos rápidos bajo la lista de "Hoy" (GER-50): alta de cliente,
 * venta e interacción. Ver Design/Hoy.dc.html.
 */
export function QuickAddPanel() {
  return (
    <div className="mt-5 space-y-3">
      <QuickAddClient />
      <QuickAddSale />
      <QuickAddInteraction />
    </div>
  );
}
