import React from "react";

interface Props {
  value: number;
}

export default function ConfidenceRing({ value }: Props) {
  const color =
    value >= 90
      ? "#16A34A"
      : value >= 75
      ? "#D97706"
      : "#DC2626";

  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        border: `6px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        background: "#fff",
      }}
    >
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color,
        }}
      >
        {value}%
      </span>

      <span
        style={{
          fontSize: 10,
          color: "#6B7280",
        }}
      >
        IA
      </span>
    </div>
  );
}