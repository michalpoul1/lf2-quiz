"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CollectionDetail from "@/components/CollectionDetail";

function Inner() {
  const params = useSearchParams();
  const id = params.get("id") || "";
  if (!id) {
    return (
      <main className="pt-10 text-center">
        <p className="text-gray-500">Chybí ID kolekce.</p>
      </main>
    );
  }
  return <CollectionDetail collectionId={id} />;
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<main className="pt-6"><p className="text-sm text-gray-500">Načítání...</p></main>}>
      <Inner />
    </Suspense>
  );
}
