import { redirect } from "@/i18n/navigation";

type Props = { params: { locale: string } };

/** Legacy pilot URL → Best of Position series. */
export default function Mid50ValueBandRedirect({ params }: Props) {
  redirect({
    href: "/fpl/insights/best-of-position/mid-5-0",
    locale: params.locale,
  });
}
