import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Match Cut Generator',
  description: 'Auto-Aligned Match Cut Video Generator - Create smooth eye-aligned animations from your photos',
  keywords: ['match cut', 'video generator', 'face alignment', 'animation', 'gif', 'mp4'],
  authors: [{ name: 'Match Cut Generator' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          {children}
        </div>
      </body>
    </html>
  )
}