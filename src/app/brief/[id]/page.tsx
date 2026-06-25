export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-body)",
      color: "var(--text-secondary)",
    }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{
          fontFamily: "var(--font-heading)",
          fontSize: 32,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}>
          Board Brief
        </h1>
        <p>Brief ID: {id}</p>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Board Brief renderer coming soon.
        </p>
      </div>
    </div>
  );
}
