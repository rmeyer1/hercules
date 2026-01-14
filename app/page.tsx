export default function HomePage() {
  return (
    <section className="grid gap-8">
      <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.35em] text-black/50">
          Options income qualifier
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-ink md:text-5xl">
          Underwrite options trades with discipline.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-black/70">
          Hercules ranks and explains sell-side opportunities, filtering out weak fundamentals and
          fragile liquidity before premium ever enters the conversation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-ember/10 px-4 py-2 text-ember">Market-first bias</span>
          <span className="rounded-full bg-black/5 px-4 py-2 text-black/70">
            30-60 DTE focus
          </span>
          <span className="rounded-full bg-black/5 px-4 py-2 text-black/70">
            Risk flags surfaced
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Qualify",
            body: "Hard filters on liquidity, volatility, and assignment quality."
          },
          {
            title: "Rank",
            body: "Weighted scorecard blends fundamentals, trend, and event risk."
          },
          {
            title: "Explain",
            body: "Every candidate includes context and guardrails before execution."
          }
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-black/10 bg-white/80 p-6"
          >
            <h2 className="text-lg font-semibold text-ink">{item.title}</h2>
            <p className="mt-2 text-sm text-black/70">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
