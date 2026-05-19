import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Pass Key | Event Ticket Management",
  description: "Secure and beautiful event ticketing system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-white min-h-screen flex justify-center`}>
        {/* Mobile Viewport Wrapper */}
        <div className="w-full max-w-md min-h-screen relative shadow-2xl overflow-hidden bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}
