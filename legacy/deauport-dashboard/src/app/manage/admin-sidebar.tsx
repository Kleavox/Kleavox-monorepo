import { RecapCard } from "./recap-card-client";
import { ImportCard } from "./import-card-client";

export function AdminSidebar() {
  return (
    <aside className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold leading-6">Data Tools</h3>
      </div>
      <RecapCard />
      <ImportCard />
    </aside>
  );
}