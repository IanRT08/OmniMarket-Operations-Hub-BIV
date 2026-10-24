import { redirect } from "next/navigation";

// El dashboard de KPIs aún no existe: por ahora el inicio es el Kanban.
export default function Home() {
  redirect("/kanban");
}
