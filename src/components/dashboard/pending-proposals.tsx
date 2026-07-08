import StatusPill from "@/components/ui/status-pill";

const proposals = [
  {
    name: "Dylan Ennis",
    score: 92,
    risk: "Bajo",
    status: "Pendiente",
  },
  {
    name: "Launch of Legón",
    score: 64,
    risk: "Medio",
    status: "Pendiente",
  },
  {
    name: "Aspar Academy",
    score: 86,
    risk: "Bajo",
    status: "Pendiente",
  },
];

export default function PendingProposals() {
  return (
    <div className="surface" style={{ padding: 24 }}>

      <h2
        style={{
          fontSize: 20,
          marginBottom: 20,
          fontWeight: 700,
        }}
      >
        Propuestas prioritarias
      </h2>

      {proposals.map((proposal) => (
        <div
          key={proposal.name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "18px 0",
            borderBottom: "1px solid #F3F4F6",
            alignItems: "center",
          }}
        >
          <div>

            <strong>{proposal.name}</strong>

            <div
              style={{
                fontSize: 13,
                color: "#6B7280",
              }}
            >
              Score {proposal.score}
            </div>

          </div>

          <StatusPill variant="pending">
            {proposal.status}
          </StatusPill>

        </div>
      ))}

    </div>
  );
}