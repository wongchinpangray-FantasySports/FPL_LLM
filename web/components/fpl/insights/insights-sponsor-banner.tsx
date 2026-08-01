export function InsightsSponsorBanner({
  sponsorName,
  sponsorHref,
  disclosure,
}: {
  sponsorName: string;
  sponsorHref: string;
  disclosure: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        {disclosure}{" "}
        <a
          href={sponsorHref}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="font-medium text-brand-accent hover:underline"
        >
          {sponsorName}
        </a>
      </p>
    </div>
  );
}
