import Link from "next/link";

export default function GuideIndex() {
  // Minimal stub that points to How to Play
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
        Guide
      </h1>
      <p>
        Start with <Link href="/guide/how-to-play">How to Play</Link>, or see the{" "}
        <Link href="/guide/scoring-matrix">Scoring Matrix</Link> and{" "}
        <Link href="/guide/faq">FAQ</Link>.
      </p>
    </main>
  );
}
