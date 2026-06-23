import { redirect } from "@/i18n/navigation";

type Props = { params: { locale: string } };

export default function LegacyMiniRedirect({ params }: Props) {
  redirect({ href: "/play/mini", locale: params.locale });
}
