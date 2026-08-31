"use client";

import QuestionList from "@/components/QuestionList";

export default function ChemistryWrongPage() {
  return (
    <QuestionList
      subject="chemistry"
      subjectPath="chemistry"
      backHref="/chemistry"
      wrongOnly
    />
  );
}
