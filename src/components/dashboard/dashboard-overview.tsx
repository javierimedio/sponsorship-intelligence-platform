import StatCard from "@/components/ui/stat-card";
import ConfidenceRing from "@/components/ui/confidence-ring";

export default function DashboardOverview() {
  return (
    <div className="page-container">

      <h1 className="section-title">
        Sponsorship Intelligence
      </h1>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div className="cards-grid" style={{ flex: 1 }}>

          <StatCard
            title="Propuestas"
            value={28}
            subtitle="6 pendientes de revisión"
          />

          <StatCard
            title="Aprobadas"
            value={14}
            subtitle="50 %"
          />

          <StatCard
            title="Inversión"
            value="94.500 €"
            subtitle="Comprometida"
          />

          <StatCard
            title="ROI previsto"
            value="3,6x"
            subtitle="Promedio"
          />

        </div>

        <ConfidenceRing value={94} />

      </div>

    </div>
  );
}