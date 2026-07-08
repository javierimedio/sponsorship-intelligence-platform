import React from "react";

type Variant =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "risk-low"
  | "risk-medium"
  | "risk-high"
  | "score-high"
  | "score-medium"
  | "score-low";

interface StatusPillProps {
  children: React.ReactNode;
  variant?: Variant;
}

const styles: Record<Variant, React.CSSProperties> = {
  draft: {
    background: "#F3F4F6",
    color: "#374151",
  },
  pending: {
    background: "#FEF3C7",
    color: "#92400E",
  },
  approved: {
    background: "#DCFCE7",
    color: "#166534",
  },
  rejected: {
    background: "#FEE2E2",
    color: "#991B1B",
  },
  completed: {
    background: "#DBEAFE",
    color: "#1E3A8A",
  },
  "risk-low": {
    background: "#DCFCE7",
    color: "#166534",
  },
  "risk-medium": {
    background: "#FEF3C7",
    color: "#92400E",
  },
  "risk-high": {
    background: "#FEE2E2",
    color: "#991B1B",
  },
  "score-high": {
    background: "#DCFCE7",
    color: "#166534",
  },
  "score-medium": {
    background: "#FEF3C7",
    color: "#92400E",
  },
  "score-low": {
    background: "#FEE2E2",
    color: "#991B1B",
  },
};

export default function StatusPill({
  children,
  variant = "draft",
}: StatusPillProps) {
  return (
    <span
      style={{
        ...styles[variant],
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 600,
        fontSize: 12,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}