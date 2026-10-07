import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CHA Employee Portal',
  description: 'Community Housing Associates — Employee Portal',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark choice before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('cha-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}" }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  )
}
