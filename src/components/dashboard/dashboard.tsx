import DashboardOverview from "./dashboard-overview";
import PendingProposals from "./pending-proposals";

export default function Dashboard() {
  return (
    <>

      <DashboardOverview />

      <div
        className="page-container"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 24,
        }}
      >

        <div className="surface" style={{ minHeight: 420 }}>

          <div style={{ padding: 24 }}>

            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Pipeline de colaboraciones
            </h2>

            <p
              style={{
                color: "#6B7280",
              }}
            >
              Timeline y pipeline llegarán en el Commit 001.4
            </p>

          </div>

        </div>

        <PendingProposals />

      </div>

    </>
  );
}