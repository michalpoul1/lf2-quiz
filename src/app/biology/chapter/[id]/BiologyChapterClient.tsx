"use client";

import { use } from "react";
import QuestionList from "@/components/QuestionList";

export default function BiologyChapterClient({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const chapterId = Number(params.id);
  return (
    <QuestionList
      subject="biology"
      subjectPath="biology"
      chapterId={chapterId}
      backHref="/biology"
    />
  );
}
