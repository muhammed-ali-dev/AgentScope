import "./styles.css";

export const metadata = { title: "AgentScope / Mission Control", description: "Trace, replay, and evaluate agent runs." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
