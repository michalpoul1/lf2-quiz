"use client";

import QuestionList from "@/components/QuestionList";

export default function BiologyWrongPage() {
  return (
    <QuestionList
      subject="biology"
      subjectPath="biology"
      backHref="/biology"
      wrongOnly
    />
  );
}
