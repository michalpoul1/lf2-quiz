"use client";

import { useParams } from "next/navigation";
import ChapterList from "@/components/ChapterList";

export default function BiologyPage() {
  const routeParams = useParams();
  const facultyId = String(routeParams?.facultyId ?? "2lf");
  return <ChapterList facultyId={facultyId} subject="biology" subjectName="Biologie" />;
}
