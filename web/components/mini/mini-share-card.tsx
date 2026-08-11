"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { MiniPickStored } from "@/lib/mini/types";

export function MiniShareCard({
  locale,
  nickname,
  gw,
  rank,
  totalPoints,
  picks,
  captainId,
}: {
  locale: string;
  nickname: string;
  gw: number | null;
  rank: number | null;
  totalPoints: number | null;
  picks: MiniPickStored[];
  captainId: number | null;
}) {
  const t = useTranslations("mini");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  async function drawAndDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const w = 720;
      const h = 900;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#0b1f17");
      grad.addColorStop(1, "#163528");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "#7dffa8";
      ctx.font = "600 28px system-ui, sans-serif";
      ctx.fillText("FALEAGUE Mini 5", 40, 70);

      ctx.fillStyle = "#ffffff";
      ctx.font = "700 44px system-ui, sans-serif";
      ctx.fillText(nickname || "Manager", 40, 140);

      ctx.fillStyle = "#b7cfc2";
      ctx.font = "500 24px system-ui, sans-serif";
      const gwLabel =
        locale === "zh"
          ? `GW${gw ?? "—"} 阵容`
          : `GW${gw ?? "—"} squad`;
      ctx.fillText(gwLabel, 40, 185);

      if (rank != null || totalPoints != null) {
        ctx.fillStyle = "#7dffa8";
        ctx.font = "600 28px system-ui, sans-serif";
        const stats =
          locale === "zh"
            ? `排名 #${rank ?? "—"} · ${totalPoints ?? 0} 分`
            : `Rank #${rank ?? "—"} · ${totalPoints ?? 0} pts`;
        ctx.fillText(stats, 40, 230);
      }

      let y = 300;
      for (const p of picks) {
        const isCap = p.fpl_id === captainId;
        ctx.fillStyle = "#1f3d30";
        ctx.fillRect(40, y - 36, w - 80, 64);
        ctx.fillStyle = "#ffffff";
        ctx.font = "600 26px system-ui, sans-serif";
        ctx.fillText(
          `${isCap ? "(C) " : ""}${p.web_name ?? p.fpl_id}`,
          56,
          y,
        );
        ctx.fillStyle = "#9bb5a8";
        ctx.font = "500 18px system-ui, sans-serif";
        ctx.fillText(`${p.team ?? ""} · ${p.position ?? ""}`, 56, y + 22);
        y += 80;
      }

      ctx.fillStyle = "#7dffa8";
      ctx.font = "500 20px system-ui, sans-serif";
      ctx.fillText("faleague.cn · Mini 5", 40, h - 40);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mini5-gw${gw ?? "x"}-${nickname || "squad"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <canvas ref={canvasRef} className="hidden" />
      <Button
        type="button"
        variant="secondary"
        disabled={busy || picks.length !== 5}
        onClick={() => void drawAndDownload()}
      >
        {busy ? t("shareBusy") : t("shareDownload")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("shareHint")}</p>
    </div>
  );
}
