import React from "react";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
}: Props) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        padding: 20,
        minWidth: 220,
        boxShadow: "0 2px 8px rgba(0,0,0,.04)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#6B7280",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: "#111827",
        }}
      >
        {value}
      </div>

      {subtitle && (
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            color: "#6B7280",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}