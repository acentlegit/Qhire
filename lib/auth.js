import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './db.js'
import bcrypt from 'bcryptjs'
import { withRetry } from './db-retry.js'
import { createSession } from './auth/sessions.js'
import { findOrCreateDevice } from './auth/devices.js'
import { logAuthEvent, AUDIT_ACTIONS } from './audit.js'
import { evaluateRisk, checkIPReputation, detectTimeOfDay } from './security/risk-engine.js'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required')
        }

        // Use retry logic for database connection
        const user = await withRetry(async () => {
          return await prisma.user.findUnique({
            where: { email: credentials.email }
          })
        })

        if (!user) {
          throw new Error('Invalid email or password')
        }

        // If user has no password (seeded user), allow login
        if (!user.password) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        }

        // Verify password if it exists
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          // Log failed login attempt
          await logAuthEvent({
            userId: user.id,
            action: AUDIT_ACTIONS.LOGIN_FAILED,
            success: false,
            req,
            riskScore: 30
          })
          throw new Error('Invalid email or password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    })
  ],
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // This event fires after successful sign in
      try {
        // Get request info for session/device creation
        // Note: We'll create session in a callback since we don't have req here
        // But we can update user's last login info
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0 // Reset on successful login
          }
        })
      } catch (error) {
        console.error('Error updating user login info:', error)
      }
    }
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup'
  },
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET,
  url: process.env.NEXTAUTH_URL
}

