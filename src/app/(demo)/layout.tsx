import { UIProvider } from "@/components/ui-provider";
export default function DemoLayout({ children }: { children: React.ReactNode }) { return <UIProvider>{children}</UIProvider>; }
