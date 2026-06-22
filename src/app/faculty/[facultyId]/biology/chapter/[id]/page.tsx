import { getActiveFaculties } from "@/config/faculties";
import { getSubjectData } from "@/lib/data";
import BiologyChapterClient from "./BiologyChapterClient";

export function generateStaticParams() {
  const out: { facultyId: string; id: string }[] = [];
  for (const f of getActiveFaculties()) {
    const data = getSubjectData(f.id, "biology");
    if (!data) continue;
    // Only emit chapter detail pages for chapters that actually have subchapters.
    for (const ch of data.chapters) {
      if (ch.subchapters && ch.subchapters.length > 0) {
        out.push({ facultyId: f.id, id: String(ch.id) });
      }
    }
  }
  return out;
}

export default function BiologyChapterPage({
  params,
}: {
  params: Promise<{ facultyId: string; id: string }>;
}) {
  return <BiologyChapterClient paramsPromise={params} />;
}
