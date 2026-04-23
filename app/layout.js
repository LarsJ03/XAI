import "./globals.css";

export const metadata = {
  title: "Counterfactual User Study",
  description: "A Next.js user-study flow for comparing counterfactual explanations."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
