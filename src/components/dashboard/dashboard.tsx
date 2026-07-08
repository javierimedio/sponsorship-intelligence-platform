export default function Dashboard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 24,
      }}
    >
      <h1
        style={{
          fontSize: 34,
          fontWeight: 700,
          margin: 0,
        }}
      >
        Sponsorship Intelligence
      </h1>

      <p
        style={{
          color: "#6B7280",
          marginTop: -10,
        }}
      >
        Executive Dashboard
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,minmax(180px,1fr))",
          gap: 20,
        }}
      >
        <DashboardCard
          title="Propuestas"
          value="28"
        />

        <DashboardCard
          title="Pendientes"
          value="6"
        />

        <DashboardCard
          title="Inversión"
          value="94.500 €"
        />

        <DashboardCard
          title="ROI"
          value="3,6x"
        />
      </div>

      <div
        style={{
          background: "white",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          padding: 24,
        }}
      >
        <h2>Bienvenido 👋</h2>

        <p>
          Este Dashboard irá evolucionando durante los próximos commits.
        </p>

      </div>

    </div>
  );
}

function DashboardCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#6B7280",
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}
