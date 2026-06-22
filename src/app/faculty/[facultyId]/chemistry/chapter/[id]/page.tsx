import { getActiveFaculties } from "@/config/faculties";
import { getSubjectData } from "@/lib/data";
import ChemistryChapterClient from "./ChemistryChapterClient";

export function generateStaticParams() {
  const out: { facultyId: string; id: string }[] = [];
  for (const f of getActiveFaculties()) {
    const data = getSubjectData(f.id, "chemistry");
    if (!data) continue;
    for (const ch of data.chapters) {
      out.push({ facultyId: f.id, id: String(ch.id) });
    }
  }
  return out;
}

export default function ChemistryChapterPage({
  params,
}: {
  params: Promise<{ facultyId: string; id: string }>;
}) {
  return <ChemistryChapterClient paramsPromise={params} />;
}
