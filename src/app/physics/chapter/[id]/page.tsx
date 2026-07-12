import { getSubjectData } from "@/lib/data";
import PhysicsChapterClient from "./PhysicsChapterClient";

export function generateStaticParams() {
  const data = getSubjectData("physics");
  if (!data) return [];
  return data.chapters.map((ch) => ({ id: String(ch.id) }));
}

export default function PhysicsChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PhysicsChapterClient paramsPromise={params} />;
}
