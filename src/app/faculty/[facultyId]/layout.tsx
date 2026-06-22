import { getActiveFaculties } from "@/config/faculties";

export function generateStaticParams() {
  return getActiveFaculties().map((f) => ({ facultyId: f.id }));
}

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
