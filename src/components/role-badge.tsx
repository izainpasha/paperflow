import type { AccessRole } from "@/lib/types";

const STYLES: Record<AccessRole, string> = {
  owner: "bg-slate-100 text-slate-700",
  editor: "bg-emerald-50 text-emerald-700",
  viewer: "bg-amber-50 text-amber-800",
};

const LABELS: Record<AccessRole, string> = {
  owner: "Owner",
  editor: "Shared · Can edit",
  viewer: "Shared · View only",
};

export function RoleBadge({ role }: { role: AccessRole }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[role]}`}>
      {LABELS[role]}
    </span>
  );
}
