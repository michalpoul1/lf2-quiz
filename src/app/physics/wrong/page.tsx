"use client";

import QuestionList from "@/components/QuestionList";

export default function PhysicsWrongPage() {
  return (
    <QuestionList
      subject="physics"
      subjectPath="physics"
      backHref="/physics"
      wrongOnly
    />
  );
}
