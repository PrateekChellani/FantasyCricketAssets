// app/faq/page.tsx
import Link from "next/link";

type QA = { q: string; a: React.ReactNode };
type Category = { title: string; items: QA[] };

const categories: Category[] = [
  {
    title: "Accounts & Security",
    items: [
      {
        q: "How do I change my email or password?",
        a: (
          <>
            You can change your <strong>password</strong> in the <Link href="/profile">Profile</Link> section.
            Changing your <strong>email</strong> is not supported right now.
          </>
        ),
      },
      {
        q: "I can’t access my account—what should I do?",
        a: (
          <>
            Try resetting your password from the sign-in flow. (Password reset page coming soon.)
          </>
        ),
      },
      {
        q: "How do I delete my account and data?",
        a: (
          <>
            You can request deletion from the <Link href="/profile">Profile</Link> section.
          </>
        ),
      },
      {
        q: "Do you offer two-factor authentication (2FA)?",
        a: <>TBD.</>,
      },
    ],
  },
  {
    title: "Packs & Inventory",
    items: [
      { q: "How do I earn packs?", a: <>TBD.</> },
      { q: "Do packs expire?", a: <>No, packs do not expire.</> },
      {
        q: "Are cards unique / serialized?",
        a: <>TBC — cards are not unique currently.</>,
      },
      { q: "Can I trade or gift cards right now?", a: <>No, but eventually.</> },
      {
        q: "What happens to a card if the real-world player retires?",
        a: (
          <>
            The card will remain in your inventory (TBC), but will not earn points.
          </>
        ),
      },
    ],
  },
  {
    title: "Squad Submission & Weekly Flow",
    items: [
      {
        q: "When does the weekly squad lock?",
        a: <>TBC — likely Sunday at 12:00 PM (Noon) EST.</>,
      },
      { q: "Can I edit my squad after submitting?", a: <>Yes.</> },
      {
        q: "What if a selected player doesn’t play?",
        a: <>No auto-subs. That player scores 0 points.</>,
      },
      {
        q: "How are abandoned or shortened matches handled?",
        a: (
          <>
            If a match has a result (including DLS), players involved receive points. If it’s abandoned or ends in
            <em> No Result</em>, no points are awarded.
          </>
        ),
      },
    ],
  },
  {
    title: "Scoring & Leaderboards",
    items: [
      {
        q: "Which match formats are supported?",
        a: (
          <>
            TBD — currently T20 and ODIs only, though we expect all formats to be supported when live.
          </>
        ),
      },
      { q: "Do domestic leagues and ICC events count?", a: <>Yes; full list TBC.</> },
      { q: "Do you award bonus points (milestones, MoM, etc.)?", a: <>TBC.</> },
      { q: "Do substitute fielders or concussion subs score?", a: <>No, not currently.</> },
      { q: "When are weekly points finalized?", a: <>TBC.</> },
      { q: "How are ties on the leaderboard resolved?", a: <>TBC.</> },
    ],
  },
  {
    title: "Data Sources & Corrections",
    items: [
      {
        q: "If Cricinfo updates stats later, do you recalculate?",
        a: <>No (TBC).</>,
      },
      {
        q: "How do you handle discrepancies between Cricinfo app and site?",
        a: <>TBC.</>,
      },
    ],
  },
  {
    title: "Roadmap & Feedback",
    items: [
      {
        q: "How can I suggest a feature or report an idea?",
        a: (
          <>
            Please use the <Link href="/contact-us">Contact Us</Link> form.
          </>
        ),
      },
      { q: "Will you add other sports?", a: <>That’s not currently on our radar.</> },
      { q: "Where can I follow updates and announcements?", a: <>TBC.</> },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Frequently Asked Questions</h1>

      <p className="mb-8 text-sm">
        For gameplay basics, see the{" "}
        <Link href="/guide" className="underline">
          Guide
        </Link>
        . For how points are calculated, see the{" "}
        <Link href="/guide/scoring-matrix" className="underline">
          Scoring Matrix
        </Link>
        . Still stuck?{" "}
        <Link href="/contact-us" className="underline">
          Contact us
        </Link>
        .
      </p>

      <div className="space-y-10">
        {categories.map((cat) => (
          <section key={cat.title}>
            <h2 className="text-2xl font-semibold mb-4">{cat.title}</h2>
            <ul className="space-y-2">
              {cat.items.map(({ q, a }) => (
                <li key={q}>
                  <details className="group rounded border border-gray-200">
                    <summary className="flex items-center justify-between cursor-pointer select-none p-4">
                      <span className="font-medium">{q}</span>
                      <span
                        aria-hidden
                        className="transition-transform group-open:rotate-180"
                      >
                        ▼
                      </span>
                    </summary>
                    <div className="p-4 pt-0 text-sm leading-relaxed">{a}</div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
