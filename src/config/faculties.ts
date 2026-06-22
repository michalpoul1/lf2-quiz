export interface Subject {
  id: string;
  name: string;
  icon: string;
  dataKey: string; // used by getSubjectData
}

export interface Faculty {
  id: string;
  name: string; // e.g. "2. LF UK"
  shortName: string; // e.g. "2.LF"
  fullName: string; // long name
  subjects: Subject[];
  active: boolean;
}

export const faculties: Faculty[] = [
  {
    id: "2lf",
    name: "2. LF UK",
    shortName: "2.LF",
    fullName: "2. lékařská fakulta Univerzity Karlovy",
    active: true,
    subjects: [
      { id: "biology", name: "Biologie", icon: "\u{1F9EC}", dataKey: "biology" },
      { id: "chemistry", name: "Chemie", icon: "\u2697\uFE0F", dataKey: "chemistry" },
      { id: "physics", name: "Fyzika", icon: "\u26A1", dataKey: "physics" },
    ],
  },
  {
    id: "1lf",
    name: "1. LF UK",
    shortName: "1.LF",
    fullName: "1. lékařská fakulta Univerzity Karlovy",
    active: true,
    subjects: [
      { id: "biology", name: "Biologie", icon: "\u{1F9EC}", dataKey: "biology" },
    ],
  },
  {
    id: "lfp",
    name: "LF Plzeň",
    shortName: "Plzeň",
    fullName: "Lékařská fakulta v Plzni, Univerzita Karlova",
    active: true,
    subjects: [
      { id: "biology", name: "Biologie", icon: "\u{1F9EC}", dataKey: "biology" },
    ],
  },
  {
    id: "muni",
    name: "LF MUNI",
    shortName: "MUNI",
    fullName: "Lékařská fakulta Masarykovy univerzity",
    active: false,
    subjects: [],
  },
  {
    id: "lfhk",
    name: "LF HK",
    shortName: "HK",
    fullName: "Lékařská fakulta v Hradci Králové, Univerzita Karlova",
    active: false,
    subjects: [],
  },
  {
    id: "lfup",
    name: "LF UP",
    shortName: "Olomouc",
    fullName: "Lékařská fakulta Univerzity Palackého v Olomouci",
    active: false,
    subjects: [],
  },
];

export function getFaculty(id: string): Faculty | undefined {
  return faculties.find((f) => f.id === id);
}

export function getActiveFaculties(): Faculty[] {
  return faculties.filter((f) => f.active);
}
