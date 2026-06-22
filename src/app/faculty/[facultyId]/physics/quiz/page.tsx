"use client";

import { useSearchParams, useParams } from "next/navigation";
import { Suspense } from "react";
import QuizRunner from "@/components/QuizRunner";

function QuizContent() {
  const routeParams = useParams();
  const facultyId = String(routeParams?.facultyId ?? "2lf");
  const params = useSearchParams();
  const chapter = params.get("chapter") || "all";
  const mode = params.get("mode") || "normal";
  const startId = params.get("startId") || undefined;

  return <QuizRunner facultyId={facultyId} subject="physics" chapterParam={chapter} mode={mode} startId={startId} />;
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="pt-20 text-center text-gray-400">Načítání...</div>}>
      <QuizContent />
    </Suspense>
  );
}
