"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import QuizRunner from "@/components/QuizRunner";

function QuizContent() {
  const params = useSearchParams();
  const chapter = params.get("chapter") || "all";
  const sub = params.get("sub") || undefined;
  const mode = params.get("mode") || "normal";
  const startId = params.get("startId") || undefined;

  return (
    <QuizRunner
      facultyId="2lf"
      subject="chemistry"
      chapterParam={chapter}
      subchapterParam={sub}
      mode={mode}
      startId={startId}
    />
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="pt-20 text-center text-gray-400">Načítání...</div>}>
      <QuizContent />
    </Suspense>
  );
}
