"use client";

import { useState } from "react";
import {
  SAMPLE_REPORT_A_PDF,
  SAMPLE_REPORT_B_PDF,
  type FounderSkuId,
  getFounderWechatHandle,
} from "@/lib/billing/founder-pack";
import { FounderPackPayActions } from "@/components/billing/founder-pack-pay-actions";

export function FounderPackOffer({
  labels,
  signedInEmail,
}: {
  labels: {
    skuATitle: string;
    skuAPrice: string;
    skuABody: string;
    skuBTitle: string;
    skuBPrice: string;
    skuBBody: string;
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
      body: labels.skuABody,
      sampleHref: SAMPLE_REPORT_A_PDF,
      sampleName: "faleague-sample-a-19.pdf",
    },
    {
      id: "founder_pack" as const,
      title: labels.skuBTitle,
      price: labels.skuBPrice,
      body: labels.skuBBody,
      sampleHref: SAMPLE_REPORT_B_PDF,
      sampleName: "faleague-sample-b-49.pdf",
    },
  ];

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
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {card.price}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                    {card.body}
                  </p>
                </button>
                <a
                  href={card.sampleHref}
                  download={card.sampleName}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground no-underline hover:border-brand-accent/40 hover:bg-muted hover:text-brand-accent"
                >
                  {labels.sampleDownload}
                </a>
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
          <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground sm:text-xl">
            {sku === "gw_note" ? labels.skuATitle : labels.skuBTitle}
            <span className="ml-2 text-amber-200">
              {sku === "gw_note" ? labels.skuAPrice : labels.skuBPrice}
            </span>
          </p>
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
