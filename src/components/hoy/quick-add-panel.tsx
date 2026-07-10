"use client";

import { QuickAddClient } from "@/components/hoy/quick-add-client";
import { QuickAddSale } from "@/components/hoy/quick-add-sale";
import { QuickAddInteraction } from "@/components/hoy/quick-add-interaction";
import { QuickAddFollowUp } from "@/components/hoy/quick-add-followup";

/**
 * Los accesos rápidos bajo la lista de "Hoy": alta de cliente, venta e
 * interacción (GER-50) y "nueva tarea" para programar un seguimiento (GER-16).
 * Ver Design/Hoy.dc.html.
 */
export function QuickAddPanel() {
  return (
    <div className="mt-5 space-y-3">
      <QuickAddClient />
      <QuickAddSale />
      <QuickAddInteraction />
      <QuickAddFollowUp />
    </div>
  );
}
