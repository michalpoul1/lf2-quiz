import { getSubjectData } from "@/lib/data";
import ChemistryChapterClient from "./ChemistryChapterClient";

export function generateStaticParams() {
  const data = getSubjectData("2lf", "chemistry");
  if (!data) return [];
  return data.chapters.map((ch) => ({ id: String(ch.id) }));
}

export default function ChemistryChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ChemistryChapterClient paramsPromise={params} />;
}
