export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

/** Pre-season research is public (matches FPL_PUBLIC_PREFIXES). */
export default async function FplPreseasonLayout({ children }: Props) {
  return children;
}
