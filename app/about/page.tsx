// app/about/page.tsx
export default function AboutPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
        About Fantasy Cricket
      </h1>

      <p style={{ marginBottom: "1rem" }}>
        Fantasy Cricket is a hobby project created by a lifelong cricket fan who
        wanted to blend the thrill of{" "}
        <strong>card collecting</strong> with the strategy of{" "}
        <strong>fantasy sports</strong>. It’s built for people who enjoy
        testing their knowledge of players, conditions, and form—then seeing
        those bets of skill play out in real matches.
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 0.5rem" }}>
        The Idea
      </h2>
      <p style={{ marginBottom: "1rem" }}>
        Traditional fantasy games focus on drafts and budgets. Card games focus
        on collecting and ownership. This project meets in the middle: assemble
        your squad, follow real-world performances, and earn points. Part of the
        fun is building a collection you’re proud of—another part is making the
        right calls before the toss.
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 0.5rem" }}>
        How It Works (at a glance)
      </h2>
      <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
        <li style={{ marginBottom: "0.6rem" }}>
          Pick players you believe will perform in upcoming fixtures.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          Points are awarded based on real match stats (runs, wickets, catches, economy, etc.).
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          Leaderboards and breakdowns help you analyze where those points came from.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          Over time, build a record of your best calls and favorite players.
        </li>
      </ul>

      <p style={{ marginTop: "1rem" }}>
        New to the app? Start with the{" "}
        <a href="/guide/how-to-play">How to Play</a> guide.
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 0.5rem" }}>
        Who’s Behind It
      </h2>
      <p style={{ marginBottom: "1rem" }}>
        The project is built and maintained by <strong>Shadow</strong>, a
        business analyst based in the United States. By day, he solves data and
        process problems. By night, he tinkers with cricket stats, product
        ideas, and small web experiments like this one. Shadow enjoys clean
        interfaces, simple rules, and leaving space for strategy to shine.
      </p>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 0.5rem" }}>
        What This Project Values
      </h2>
      <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
        <li style={{ marginBottom: "0.6rem" }}>
          <strong>Fair scoring:</strong> clear rules that reward contributions across formats and roles.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          <strong>Transparency:</strong> visible point breakdowns and match-level context.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          <strong>Learning:</strong> make it easy to compare picks and learn from outcomes.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          <strong>Community:</strong> encourage friendly competition without toxicity.
        </li>
      </ul>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 0.5rem" }}>
        Roadmap (high level)
      </h2>
      <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
        <li style={{ marginBottom: "0.6rem" }}>
          Polished scoring matrix and historical backfills.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          Player leaderboards with form and venue filters.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          Optional private competitions with friends.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          Visual “card” collection views for your squad history.
        </li>
      </ul>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "2rem 0 0.5rem" }}>
        Get in Touch
      </h2>
      <p style={{ marginBottom: "1rem" }}>
        Feedback, ideas, or bugs—Shadow wants to hear them. Please use the{" "}
        <a href="/about/contact-us">Contact Us</a> form and he’ll respond as soon as he can.
      </p>

      <hr style={{ margin: "2rem 0" }} />

      <p style={{ color: "#555" }}>
        This site is a personal project and is not affiliated with any league,
        team, or governing body. All trademarks are the property of their
        respective owners.
      </p>
    </main>
  );
}
