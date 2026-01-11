export default function HowToPlayPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
        How to Play
      </h1>

      <p style={{ marginBottom: "1rem" }}>
        Fantasy Cricket blends real-world cricket performance with a collectible
        card experience. Each real cricketer has an equivalent{" "}
        <strong>fantasy card</strong> on this site. When that player performs in
        real matches, your card earns points according to our{" "}
        <a href="/guide/scoring-matrix">Scoring Matrix</a>, the match format,
        and the player’s contributions.
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 .5rem" }}>
        1) Cards & Packs
      </h2>
      <p style={{ marginBottom: "1rem" }}>
        You obtain cricketer cards by opening <strong>packs</strong>. Packs can
        be earned in multiple ways, including <em>daily log-in bonuses</em> and
        other in-app activities (more sources will be announced over time).
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 .5rem" }}>
        2) Building Your Weekly Squad (TBC)
      </h2>
      <p style={{ marginBottom: "1rem" }}>
        Each week you’ll build a squad using the cards you own in your
        inventory. The number of players is currently planned to be{" "}
        <strong>6 (TBC)</strong>, and your picks must follow the upcoming{" "}
        <strong>squad structure criteria (TBD)</strong>. When your selected
        players appear in real matches during that week, your squad earns points
        from their performances.
      </p>

      <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
        <li style={{ marginBottom: ".6rem" }}>
          You can submit <strong>one (TBC)</strong> squad per week.
        </li>
        <li style={{ marginBottom: ".6rem" }}>
          Only players you’ve selected (and who actually play) can earn your
          squad points for that week.
        </li>
        <li style={{ marginBottom: ".6rem" }}>
          You’ll be able to review and confirm your squad before the weekly
          lock. After lock, changes aren’t allowed for that week.
        </li>
      </ul>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 .5rem" }}>
        3) Scoring Basics
      </h2>
      <p style={{ marginBottom: "1rem" }}>
        Points are calculated from real match stats (e.g., runs, wickets,
        catches, economy, strike rate, milestones). Exact values depend on the{" "}
        <a href="/guide/scoring-matrix">Scoring Matrix</a> and may vary by
        format (Tests, ODIs, T20s).
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 .5rem" }}>
        4) Weekly Leaderboards & Results
      </h2>
      <p style={{ marginBottom: "1rem" }}>
        After the week closes, we total all valid squad points and publish a{" "}
        <strong>leaderboard</strong>. The highest-scoring team wins the week.
        Prizes may be offered from time to time (TBD)—for example, bonus packs
        or other in-game rewards.
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 .5rem" }}>
        5) Trading & Collection (Roadmap)
      </h2>
      <p style={{ marginBottom: "1rem" }}>
        We plan to explore <strong>card trading</strong> in the future so you
        can refine your collection, fill gaps for squad building, or trade with
        friends. Details and timelines are still being finalized.
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 .5rem" }}>
        Tips for New Managers
      </h2>
      <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
        <li style={{ marginBottom: ".6rem" }}>
          Watch form, roles, and venues—conditions matter.
        </li>
        <li style={{ marginBottom: ".6rem" }}>
          Balance your squad (TBD structure) so you’re not overexposed to one
          match or skill set.
        </li>
        <li style={{ marginBottom: ".6rem" }}>
          Use leaderboards and breakdowns to learn which picks drove points.
        </li>
      </ul>

      <hr style={{ margin: "2rem 0" }} />

      <p style={{ marginBottom: "1rem" }}>
        Have questions? Check the <a href="/guide/faq">FAQ</a>. If you still
        need help, reach out via <a href="/about/contact-us">Contact Us</a>.
      </p>
    </main>
  );
}
