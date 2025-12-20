import { withAuth } from 'next-auth/middleware'

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      // Allow access to auth pages without authentication
      if (req.nextUrl.pathname.startsWith('/auth')) {
        return true
      }
      // Protect all other routes
      return !!token
    }
  },
  pages: {
    signIn: '/auth/signin'
  }
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/ (all API routes - they handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico).*)'
  ]
}

