import { HISTORICAL_API_VERSION } from "@/lib/historical/api";

const BASE = "https://www.faleague-ai.com";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[12px] leading-relaxed text-foreground md:text-[13px]">
      <code>{children.trim()}</code>
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3 scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Public-facing Historical API docs (shareable URL + issued Bearer key).
 */
export function HistoricalApiDocs() {
  return (
    <div className="flex flex-col gap-8 text-sm text-muted-foreground">
      <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-foreground">
        <p className="text-xs uppercase tracking-[0.12em] text-brand-accent">
          Share this page
        </p>
        <p className="mt-1 break-all font-mono text-[13px]">
          {BASE}/docs/historical-api
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Version <span className="text-foreground">{HISTORICAL_API_VERSION}</span>
          {" · "}
          Base <span className="font-mono text-foreground">{BASE}/api/historical/v1</span>
        </p>
      </div>

      <Section id="overview" title="Overview">
        <p>
          Read API for Fantasy Premier League historical gameweek aggregates
          (≈2016/17–present). Data is sourced from the official FPL API plus the{" "}
          <a
            href="https://github.com/vaastav/Fantasy-Premier-League"
            className="text-brand-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            vaastav/Fantasy-Premier-League
          </a>{" "}
          backfill — credit both when redistributing.
        </p>
      </Section>

      <Section id="auth" title="Auth">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] text-left text-[13px]">
            <thead className="border-b border-border bg-muted/30 text-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Endpoint</th>
                <th className="px-3 py-2 font-medium">Auth</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["GET /api/historical/v1", "Public"],
                ["GET /api/historical/v1/meta", "Public"],
                ["GET /api/historical/v1/suggest", "Public"],
                ["GET /api/historical/v1/stats", "Bearer"],
                ["GET /api/historical/v1/player", "Bearer"],
              ].map(([ep, auth]) => (
                <tr key={ep} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2 font-mono text-[12px] text-foreground">
                    {ep}
                  </td>
                  <td className="px-3 py-2">{auth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Partner endpoints require a key we issue to you:
        </p>
        <CodeBlock>{`Authorization: Bearer <YOUR_HISTORICAL_API_KEY>`}</CodeBlock>
        <p className="text-xs">
          Ask FALEAGUE for a key — do not share it publicly. Keys can be rotated
          per partner.
        </p>
      </Section>

      <Section id="endpoints" title="Endpoints">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h3 className="font-medium text-foreground">Contract (public)</h3>
            <CodeBlock>{`GET ${BASE}/api/historical/v1`}</CodeBlock>
            <p>Returns version, auth map, and ID semantics notes.</p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-medium text-foreground">Meta (public)</h3>
            <CodeBlock>{`GET ${BASE}/api/historical/v1/meta`}</CodeBlock>
            <p>
              Response shape:{" "}
              <code className="rounded bg-muted/50 px-1 py-0.5 text-[12px] text-foreground">
                {"{ seasons, activeSeason, teams[], gwBounds }"}
              </code>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-medium text-foreground">Suggest (public)</h3>
            <CodeBlock>{`GET ${BASE}/api/historical/v1/suggest?q=haaland&season=2024&position=FWD&limit=12`}</CodeBlock>
            <p>
              Optional: <code className="text-foreground">locale</code>,{" "}
              <code className="text-foreground">teamId</code>.{" "}
              <code className="text-foreground">limit</code> capped at 25.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-medium text-foreground">Stats (Bearer)</h3>
            <CodeBlock>{`GET ${BASE}/api/historical/v1/stats?season=2024&gwFrom=1&gwTo=38&position=MID&sortBy=total_points&sortDir=desc&limit=50&offset=0
Authorization: Bearer <YOUR_HISTORICAL_API_KEY>`}</CodeBlock>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code className="text-foreground">season</code> — year key (
                <code className="text-foreground">2024</code>) or{" "}
                <code className="text-foreground">ALL</code>
              </li>
              <li>
                <code className="text-foreground">position</code> —{" "}
                <code className="text-foreground">GKP | DEF | MID | FWD</code>
              </li>
              <li>
                <code className="text-foreground">sortBy</code> —{" "}
                total_points, goals_scored, assists, expected_goals,
                expected_assists, clean_sheets, minutes, bonus, ict_index, bps,
                defensive_contribution, points_per90, appearances
              </li>
              <li>
                <code className="text-foreground">limit</code> — max{" "}
                <strong className="text-foreground">100</strong>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-medium text-foreground">Player detail (Bearer)</h3>
            <CodeBlock>{`GET ${BASE}/api/historical/v1/player?playerId=355&season=2024&gwFrom=1&gwTo=10
Authorization: Bearer <YOUR_HISTORICAL_API_KEY>`}</CodeBlock>
            <p>
              Optional roster hints:{" "}
              <code className="text-foreground">webName</code>,{" "}
              <code className="text-foreground">name</code>,{" "}
              <code className="text-foreground">team</code>,{" "}
              <code className="text-foreground">position</code>.
            </p>
          </div>
        </div>
      </Section>

      <Section id="ids" title="ID semantics">
        <p>
          <code className="text-foreground">playerId</code> /{" "}
          <code className="text-foreground">fpl_id</code> is{" "}
          <strong className="text-foreground">season-scoped</strong>. The same
          numeric id can refer to different players in different seasons. Always
          pair with <code className="text-foreground">season</code>, and prefer{" "}
          <code className="text-foreground">web_name</code> / suggest keys for
          identity.
        </p>
      </Section>

      <Section id="examples" title="curl examples">
        <CodeBlock>{`# Public meta
curl -sS "${BASE}/api/historical/v1/meta"

# Suggest
curl -sS "${BASE}/api/historical/v1/suggest?q=salah&season=2024"

# Partner stats
curl -sS \\
  -H "Authorization: Bearer $HISTORICAL_API_KEY" \\
  "${BASE}/api/historical/v1/stats?season=2024&position=FWD&limit=20"

# Partner player detail
curl -sS \\
  -H "Authorization: Bearer $HISTORICAL_API_KEY" \\
  "${BASE}/api/historical/v1/player?playerId=355&season=2024"`}</CodeBlock>
      </Section>

      <Section id="notes" title="Notes">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            All responses include header{" "}
            <code className="text-foreground">
              X-Historical-API-Version: {HISTORICAL_API_VERSION}
            </code>
          </li>
          <li>Rate limits may apply per IP when configured</li>
          <li>No bulk dump in v1 — paginate stats instead</li>
          <li>
            Interactive explorer on the site:{" "}
            <a
              href={`${BASE}/fpl/historical`}
              className="text-brand-accent hover:underline"
            >
              /fpl/historical
            </a>
          </li>
        </ul>
      </Section>
    </div>
  );
}
