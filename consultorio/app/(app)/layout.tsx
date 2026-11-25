import { requireSession } from "@/lib/sesion";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  await requireSession();
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}
