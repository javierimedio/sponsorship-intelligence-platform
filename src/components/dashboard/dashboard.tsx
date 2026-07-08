import ExecutiveSummary from "./executive-summary";
import MetricsGrid from "./metrics-grid";
import PendingProposals from "./pending-proposals";

export default function Dashboard() {

  return (

    <div className="space-y-8">

      <ExecutiveSummary />

      <MetricsGrid />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">

        <div className="rounded-2xl border border-slate-200 bg-white p-6">

          <h2 className="mb-2 text-xl font-bold">
            Pipeline
          </h2>

          <p className="text-sm text-slate-500">
            Timeline y visualización del pipeline disponibles
            en el próximo commit.
          </p>

        </div>

        <PendingProposals />

      </div>

    </div>

  );

}
