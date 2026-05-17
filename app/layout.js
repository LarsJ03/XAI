import "./globals.css";

export const metadata = {
  title: "Counterfactual User Study",
  description: "A Next.js user-study flow for comparing counterfactual explanations."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="screen-size-warning" role="alert">
          <section className="panel warning-panel">
            <div className="eyebrow">Screen size</div>
            <h1>Please use a laptop or tablet-sized screen</h1>
            <p>
              This study compares several images at once. For reliable answers, open it on a screen
              at least 900px wide, preferably in landscape orientation.
            </p>
          </section>
        </div>
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}
