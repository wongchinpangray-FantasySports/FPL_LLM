import { permanentRedirect } from "next/navigation";

type Props = {
  params: { locale: string };
};

/** Retired — FPL creator archive removed for Fantasy Football Scout exclusivity. */
export default function FplCreatorsNewsPage(_props: Props) {
  permanentRedirect("/news");
}
