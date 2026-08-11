import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

/** WC Mini 5 retired — send traffic to PL Mini 5. */
export default function PlayWcMiniPage({ params }: Props) {
  redirect({ href: "/play/mini", locale: params.locale });
}
