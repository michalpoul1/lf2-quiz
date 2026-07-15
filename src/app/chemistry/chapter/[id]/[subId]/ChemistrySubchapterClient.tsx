"use client";

import { use } from "react";
import QuestionList from "@/components/QuestionList";

export default function ChemistrySubchapterClient({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string; subId: string }>;
}) {
  const params = use(paramsPromise);
  const chapterId = Number(params.id);
  const subId = decodeURIComponent(params.subId);
  return (
    <QuestionList
      subject="chemistry"
      subjectPath="chemistry"
      chapterId={chapterId}
      subchapterId={subId}
      backHref={`/chemistry/chapter/${chapterId}`}
    />
  );
}
