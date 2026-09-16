const foundations = [
  "Next.js web application",
  "Local PostgreSQL with Drizzle migrations",
  "Cloud authentication boundary reserved for Phase 3",
  "Private local upload directory",
] as const;

export default function HomePage() {
  return (
    <main>
      <section className="foundation" aria-labelledby="page-title">
        <p className="eyebrow">Noted · Phase 1</p>
        <h1 id="page-title">The foundation is ready.</h1>
        <p className="introduction">
          This temporary page confirms the local workspace is running. The 3D
          family fridge arrives in Phase 2.
        </p>

        <ul>
          {foundations.map((foundation) => (
            <li key={foundation}>
              <span aria-hidden="true">✓</span>
              {foundation}
            </li>
          ))}
        </ul>

        <p className="health">
          Database check: <a href="/api/health">/api/health</a>
        </p>
      </section>
    </main>
  );
}
