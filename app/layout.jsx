import './globals.css'
import SessionProvider from '../components/providers/SessionProvider'
import QueryProvider from '../components/providers/QueryProvider'
import { ThemeProvider } from '../components/providers/ThemeProvider'
import SessionInitializer from '../components/security/SessionInitializer'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'QHire',
  description: 'QHire Full Production',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <SessionProvider>
            <ThemeProvider>
              <SessionInitializer />
              {children}
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 4000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </ThemeProvider>
          </SessionProvider>
        </QueryProvider>
      </body>
    </html>
  )
}

