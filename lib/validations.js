import { z } from 'zod'

// User validation
export const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'RECRUITER', 'HIRING_MANAGER']).optional()
})

// Job validation
export const jobSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  status: z.enum(['OPEN', 'ON_HOLD', 'CLOSED']).optional(),
  createdById: z.string().min(1, 'Created by ID is required').optional(),
  // Enhanced fields
  department: z.string().optional(),
  location: z.string().optional(),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  currency: z.string().default('USD').optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  experienceLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'EXECUTIVE']).optional(),
  requirements: z.any().optional(), // JSON
  benefits: z.any().optional() // JSON
})

// Candidate validation
export const candidateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  skills: z.string().optional(),
  resumeUrl: z.string().url('Invalid URL').optional().or(z.literal(''))
})

// Application validation
export const applicationSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  candidateId: z.string().min(1, 'Candidate ID is required'),
  stage: z.enum(['Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected'])
})

// Update application schema
export const updateApplicationSchema = z.object({
  stage: z.enum(['Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected']).optional()
})

// Offer validation
export const offerSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  templateId: z.string().optional(),
  salary: z.number().int().positive().optional(),
  currency: z.string().default('USD'),
  startDate: z.string().optional().or(z.null()), // ISO date string
  benefits: z.any().optional(), // JSON
  terms: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED']).default('DRAFT')
})

export const updateOfferSchema = z.object({
  salary: z.number().int().positive().optional(),
  currency: z.string().optional(),
  startDate: z.string().optional().or(z.null()), // ISO date string
  benefits: z.any().optional(),
  terms: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED']).optional()
})

// Event validation
export const eventSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  type: z.string().min(1, 'Event type is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  start: z.string(), // ISO date string
  end: z.string(), // ISO date string
  timezone: z.string().default('UTC'),
  location: z.string().optional(),
  organizerId: z.string().optional(),
  attendees: z.any().optional() // JSON array
})

export const updateEventSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(), // ISO date string
  end: z.string().optional(), // ISO date string
  timezone: z.string().optional(),
  location: z.string().optional(),
  organizerId: z.string().optional(),
  attendees: z.any().optional()
})

// Note validation
export const noteSchema = z.object({
  candidateId: z.string().min(1, 'Candidate ID is required'),
  content: z.string().min(1, 'Content is required'),
  isPrivate: z.boolean().default(false),
  tags: z.array(z.string()).optional().or(z.any().optional())
})

export const updateNoteSchema = z.object({
  content: z.string().min(1).optional(),
  isPrivate: z.boolean().optional(),
  tags: z.array(z.string()).optional().or(z.any().optional())
})

