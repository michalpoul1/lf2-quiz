"use client";

import { use } from "react";
import QuestionList from "@/components/QuestionList";

export default function PhysicsChapterClient({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const chapterId = Number(params.id);
  return (
    <QuestionList
      subject="physics"
      subjectPath="physics"
      chapterId={chapterId}
      backHref="/physics"
    />
  );
}
