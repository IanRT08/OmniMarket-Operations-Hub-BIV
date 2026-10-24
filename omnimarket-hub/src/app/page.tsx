import { redirect } from "next/navigation";

// El inicio de la app es el dashboard (proxy.ts y el layout exigen sesión).
export default function Home() {
  redirect("/dashboard");
}
