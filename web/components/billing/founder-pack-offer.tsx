"use client";

import { useState } from "react";
import {
  LAUNCH_DISCOUNT_ACTIVE,
  SAMPLE_REPORT_A_HTML,
  SAMPLE_REPORT_A_PDF,
  SAMPLE_REPORT_B_HTML,
  SAMPLE_REPORT_B_PDF,
  type FounderSkuId,
  getFounderWechatHandle,
} from "@/lib/billing/founder-pack";
import { FounderPackPayActions } from "@/components/billing/founder-pack-pay-actions";

function SkuPrice({
  sale,
  list,
  limitedLabel,
}: {
  sale: string;
  list: string;
  limitedLabel: string;
}) {
  if (!LAUNCH_DISCOUNT_ACTIVE) {
    return (
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {sale}
      </p>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums text-foreground">
        {sale}
      </span>
      <span className="text-sm tabular-nums text-muted-foreground line-through decoration-muted-foreground/80">
        {list}
      </span>
      <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-200">
        {limitedLabel}
      </span>
    </div>
  );
}

export function FounderPackOffer({
  labels,
  signedInEmail,
}: {
  labels: {
    skuATitle: string;
    skuAPrice: string;
    skuAListPrice: string;
    skuABody: string;
    skuBTitle: string;
    skuBPrice: string;
    skuBListPrice: string;
    skuBBody: string;
    limitedOffer: string;
    sampleView: string;
    sampleDownload: string;
    includesTitle: string;
    includesA: string[];
    includesB: string[];
    addonsTitle: string;
    addons: string[];
    stepsTitle: string;
    steps: string[];
    payTitle: string;
    payBody: string;
    wechatLabel: string;
    signedInAs: string;
    note: string;
    chooseSku: string;
    wechatIdLabel: string;
    wechatIdPlaceholder: string;
    contactEmailLabel: string;
    contactEmailPlaceholder: string;
    submit: string;
    submitting: string;
    submitted: string;
    submitError: string;
    alreadyPro: string;
    needWechat: string;
    needEmail: string;
    signupTitle: string;
    signupBody: string;
    signupCta: string;
    signupLater: string;
  };
  signedInEmail?: string | null;
}) {
  const wechat = getFounderWechatHandle();
  const [sku, setSku] = useState<FounderSkuId>("founder_pack");
  const includes = sku === "gw_note" ? labels.includesA : labels.includesB;

  const cards = [
    {
      id: "gw_note" as const,
      title: labels.skuATitle,
      price: labels.skuAPrice,
      listPrice: labels.skuAListPrice,
      body: labels.skuABody,
      sampleHtml: SAMPLE_REPORT_A_HTML,
      samplePdf: SAMPLE_REPORT_A_PDF,
      sampleName: "faleague-sample-a-19.pdf",
    },
    {
      id: "founder_pack" as const,
      title: labels.skuBTitle,
      price: labels.skuBPrice,
      listPrice: labels.skuBListPrice,
      body: labels.skuBBody,
      sampleHtml: SAMPLE_REPORT_B_HTML,
      samplePdf: SAMPLE_REPORT_B_PDF,
      sampleName: "faleague-sample-b-49.pdf",
    },
  ];

  const activePrice =
    sku === "gw_note" ? labels.skuAPrice : labels.skuBPrice;
  const activeList =
    sku === "gw_note" ? labels.skuAListPrice : labels.skuBListPrice;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{labels.chooseSku}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const active = sku === card.id;
            return (
              <div key={card.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setSku(card.id)}
                  className={
                    active
                      ? "rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] p-4 text-left"
                      : "rounded-2xl border border-border bg-card p-4 text-left hover:border-amber-500/25"
                  }
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {card.title}
                  </p>
                  <SkuPrice
                    sale={card.price}
                    list={card.listPrice}
                    limitedLabel={labels.limitedOffer}
                  />
                  <p className="mt-2 whitespace-nowrap text-[13px] leading-snug text-muted-foreground sm:text-sm">
                    {card.body}
                  </p>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={card.sampleHtml}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-brand-accent/50 bg-brand-accent/15 px-3 py-2 text-sm font-medium text-brand-accent no-underline hover:bg-brand-accent/25"
                  >
                    {labels.sampleView}
                  </a>
                  <a
                    href={card.samplePdf}
                    download={card.sampleName}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground no-underline hover:border-brand-accent/40 hover:bg-muted hover:text-brand-accent"
                  >
                    {labels.sampleDownload}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {labels.includesTitle}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground">{labels.addonsTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {labels.addons.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground">{labels.stepsTitle}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {labels.steps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">{labels.payTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.payBody}</p>
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.1] px-4 py-3">
          <p className="text-sm font-semibold text-foreground sm:text-base">
            {sku === "gw_note" ? labels.skuATitle : labels.skuBTitle}
          </p>
          <div className="mt-1">
            <SkuPrice
              sale={activePrice}
              list={activeList}
              limitedLabel={labels.limitedOffer}
            />
          </div>
        </div>
        {wechat ? (
          <p className="mt-3 text-sm text-foreground">
            {labels.wechatLabel}: <span className="font-medium">{wechat}</span>
          </p>
        ) : null}
        {signedInEmail ? (
          <p className="mt-3 text-sm text-foreground">
            {labels.signedInAs.replace("{email}", signedInEmail)}
          </p>
        ) : null}
        <FounderPackPayActions
          sku={sku}
          signedInEmail={signedInEmail}
          labels={{
            wechatIdLabel: labels.wechatIdLabel,
            wechatIdPlaceholder: labels.wechatIdPlaceholder,
            contactEmailLabel: labels.contactEmailLabel,
            contactEmailPlaceholder: labels.contactEmailPlaceholder,
            submit: labels.submit,
            submitting: labels.submitting,
            submitted: labels.submitted,
            submitError: labels.submitError,
            alreadyPro: labels.alreadyPro,
            needWechat: labels.needWechat,
            needEmail: labels.needEmail,
            signupTitle: labels.signupTitle,
            signupBody: labels.signupBody,
            signupCta: labels.signupCta,
            signupLater: labels.signupLater,
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">{labels.note}</p>
    </div>
  );
}
