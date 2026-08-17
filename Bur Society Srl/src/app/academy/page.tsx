import type { Metadata } from "next";
import { AcademyHero } from "@/components/academy/AcademyHero";
import { AcademyCta } from "@/components/academy/AcademyCta";
import { CourseEditorial } from "@/components/academy/CourseEditorial";
import { courses } from "@/lib/courses";

export const metadata: Metadata = {
  title: "Academy",
  description:
    "Percorsi Bur Society: Doppiaggio e DJ & Produzione. Formazione editoriale, standard da studio.",
};

export default function AcademyPage() {
  return (
    <>
      <AcademyHero />
      {courses.map((course, index) => (
        <CourseEditorial
          key={course.id}
          course={course}
          reverse={index % 2 === 1}
        />
      ))}
      <AcademyCta />
    </>
  );
}
