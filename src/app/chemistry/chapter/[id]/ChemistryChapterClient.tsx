"use client";

import { use } from "react";
import SubchapterList from "@/components/SubchapterList";

export default function ChemistryChapterClient({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const chapterId = Number(params.id);
  return (
    <SubchapterList
      subject="chemistry"
      subjectPath="chemistry"
      chapterId={chapterId}
      backHref="/chemistry"
    />
  );
}
