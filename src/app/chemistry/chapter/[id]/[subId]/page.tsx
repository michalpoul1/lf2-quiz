import { getSubjectData } from "@/lib/data";
import ChemistrySubchapterClient from "./ChemistrySubchapterClient";

export function generateStaticParams() {
  const data = getSubjectData("chemistry");
  if (!data) return [];
  const out: { id: string; subId: string }[] = [];
  for (const ch of data.chapters) {
    if (!ch.subchapters) continue;
    for (const sub of ch.subchapters) {
      out.push({ id: String(ch.id), subId: sub.id });
    }
  }
  return out;
}

export default function ChemistrySubchapterPage({
  params,
}: {
  params: Promise<{ id: string; subId: string }>;
}) {
  return <ChemistrySubchapterClient paramsPromise={params} />;
}
