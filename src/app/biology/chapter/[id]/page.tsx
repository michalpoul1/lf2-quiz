import { getSubjectData } from "@/lib/data";
import BiologyChapterClient from "./BiologyChapterClient";

export function generateStaticParams() {
  const data = getSubjectData("biology");
  if (!data) return [];
  return data.chapters.map((ch) => ({ id: String(ch.id) }));
}

export default function BiologyChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <BiologyChapterClient paramsPromise={params} />;
}
