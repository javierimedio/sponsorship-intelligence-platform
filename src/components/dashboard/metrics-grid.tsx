import StatCard from "@/components/ui/stat-card";

export default function MetricsGrid() {
  return (
    <section className="grid gap-5 lg:grid-cols-6">

      <StatCard
        title="Propuestas"
        value="28"
        subtitle="+4 este mes"
      />

      <StatCard
        title="Pendientes"
        value="6"
        subtitle="Requieren decisión"
      />

      <StatCard
        title="Score medio"
        value="82"
        subtitle="Sobre 100"
      />

      <StatCard
        title="Riesgo medio"
        value="Bajo"
        subtitle="Pipeline"
      />

      <StatCard
        title="Inversión"
        value="94.500 €"
        subtitle="Comprometida"
      />

      <StatCard
        title="ROI esperado"
        value="3,6x"
        subtitle="Estimado"
      />

    </section>
  );
}