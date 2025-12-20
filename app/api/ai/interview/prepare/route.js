import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { parseResume } from '../../../../../lib/ai/resume-parser.js'
import { aiProvider } from '../../../../../lib/ai/provider.js'
import { trackAIUsage } from '../../../../../lib/ai/usage-tracker.js'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/interview/prepare
 * Parse resume and generate personalized interview questions
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileUrl, fileName, candidateName, jobTitle } = await req.json()

    if (!fileUrl) {
      return NextResponse.json({ error: 'File URL is required' }, { status: 400 })
    }

    // Parse resume
    let resumeData = null
    try {
      let fileBuffer
      
      // Handle different URL formats
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        // Remote URL - fetch it
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error('Failed to fetch file from URL')
        }
        const arrayBuffer = await response.arrayBuffer()
        fileBuffer = Buffer.from(arrayBuffer)
      } else if (path.isAbsolute(fileUrl)) {
        // Absolute path - use directly (most common case from upload API)
        fileBuffer = await fs.readFile(fileUrl)
      } else if (fileUrl.startsWith('/uploads/')) {
        // Local uploads path (relative to project root)
        const relativePath = fileUrl.replace('/uploads/', '')
        const filePath = path.join(process.cwd(), 'uploads', relativePath)
        fileBuffer = await fs.readFile(filePath)
      } else if (fileUrl.startsWith('/')) {
        // Other local public path
        const filePath = path.join(process.cwd(), 'public', fileUrl)
        fileBuffer = await fs.readFile(filePath)
      } else if (fileUrl.startsWith('uploads/')) {
        // Uploads directory (relative)
        const filePath = path.join(process.cwd(), fileUrl)
        fileBuffer = await fs.readFile(filePath)
      } else {
        // Try as relative path from project root
        const filePath = path.join(process.cwd(), fileUrl)
        fileBuffer = await fs.readFile(filePath)
      }
      
      // Detect MIME type from file extension
      const ext = path.extname(fileName).toLowerCase()
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
      }
      const mimeType = mimeTypes[ext] || 'application/octet-stream'
      
      if (!mimeTypes[ext]) {
        return NextResponse.json(
          { error: `Unsupported file type: ${ext}. Supported types: PDF, DOC, DOCX, Images (JPG, PNG)` },
          { status: 400 }
        )
      }
      
      // Parse resume
      resumeData = await parseResume(fileBuffer, mimeType)
    } catch (parseError) {
      console.error('Resume parsing error:', parseError)
      console.error('File URL was:', fileUrl)
      console.error('File name was:', fileName)
      return NextResponse.json(
        { error: `Failed to parse resume: ${parseError.message}. Please ensure the file is readable.` },
        { status: 400 }
      )
    }

    // Generate 20 personalized questions based on resume
    const prompt = `You are an expert technical interviewer. Generate 20 personalized interview questions based on the candidate's resume.

Candidate Name: ${candidateName || 'Candidate'}
Job Title: ${jobTitle || 'Position'}

Resume Analysis:
- Name: ${resumeData.name || 'Not provided'}
- Email: ${resumeData.email || 'Not provided'}
- Phone: ${resumeData.phone || 'Not provided'}
- Skills: ${resumeData.skills?.join(', ') || 'Not provided'}
- Experience: ${JSON.stringify(resumeData.experience || [])}
- Education: ${JSON.stringify(resumeData.education || [])}
- Projects: ${JSON.stringify(resumeData.projects || [])}
- Summary: ${resumeData.summary || 'Not provided'}

Generate 20 questions that:
1. Ask about specific projects mentioned in the resume (5 questions)
2. Deep dive into technical skills listed (5 questions)
3. Explore work experience and achievements (5 questions)
4. Assess problem-solving and behavioral aspects (3 questions)
5. Understand career goals and motivation (2 questions)

Return ONLY a JSON array of question strings. Example format:
["Question 1", "Question 2", "Question 3", ...]

Make questions specific to the candidate's background, not generic.`

    try {
      const model = process.env.AI_PROVIDER === 'llm-core'
        ? (process.env.LLM_CORE_MODEL || 'llama-3.1-8b-instant')
        : (process.env.OPENAI_MODEL || 'gpt-3.5-turbo')

      const completion = await aiProvider.chatCompletion({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical interviewer. Generate personalized, specific interview questions based on candidate resumes. Always return a valid JSON array of exactly 20 question strings.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })

      let questions = []
      try {
        const content = completion.content || '[]'
        
        // Try to parse as JSON
        let parsed
        try {
          parsed = JSON.parse(content)
        } catch {
          // Try to extract JSON from markdown code blocks
          const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[1])
          } else {
            // Fallback: extract numbered questions
            const lines = content.split('\n')
            questions = lines
              .filter(line => {
                const trimmed = line.trim()
                return trimmed.match(/^\d+[\.\)]/) || trimmed.startsWith('-') || trimmed.startsWith('*')
              })
              .map(line => {
                return line
                  .replace(/^\d+[\.\)]\s*/, '')
                  .replace(/^[-*]\s*/, '')
                  .replace(/^["']|["']$/g, '')
                  .trim()
              })
              .filter(q => q.length > 10)
          }
        }

        if (parsed) {
          if (Array.isArray(parsed)) {
            questions = parsed
          } else if (parsed.questions && Array.isArray(parsed.questions)) {
            questions = parsed.questions
          }
        }
      } catch (parseErr) {
        console.error('Failed to parse questions:', parseErr)
        // Fallback: extract from text
        const lines = completion.content.split('\n')
        questions = lines
          .filter(line => line.trim().match(/^\d+[\.\)]/))
          .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
          .filter(q => q.length > 10)
      }

      // Ensure we have exactly 20 questions (pad with defaults if needed)
      const defaultQuestions = [
        'Tell me about yourself and your background.',
        'Why are you interested in this position?',
        'What are your greatest strengths?',
        'Describe a challenging project you worked on.',
        'How do you handle tight deadlines?',
        'What are your career goals?',
        'Tell me about a time you solved a difficult problem.',
        'How do you stay updated with industry trends?',
        'What motivates you in your work?',
        'Do you have any questions for us?'
      ]

      // Fill up to 20 questions
      while (questions.length < 20) {
        const defaultQ = defaultQuestions[questions.length % defaultQuestions.length]
        if (!questions.includes(defaultQ)) {
          questions.push(defaultQ)
        } else {
          questions.push(`${defaultQ} (Please elaborate)`)
        }
      }

      // Limit to 20
      questions = questions.slice(0, 20)

      // Track AI usage
      if (completion.usage && session?.user?.id) {
        await trackAIUsage({
          userId: session.user.id,
          service: 'interview_preparation',
          tokens: completion.usage.total_tokens || 0,
          inputTokens: completion.usage.prompt_tokens || 0,
          outputTokens: completion.usage.completion_tokens || 0,
          model,
          metadata: { 
            candidateName,
            jobTitle,
            resumeParsed: true,
            questionsGenerated: questions.length,
            provider: aiProvider.getProviderName() 
          }
        })
      }

      return NextResponse.json({
        success: true,
        resumeData,
        questions
      })
    } catch (aiError) {
      console.error('AI question generation error:', aiError)
      
      // Return questions based on resume data even if AI fails
      const fallbackQuestions = generateFallbackQuestions(resumeData, jobTitle)
      
      return NextResponse.json({
        success: true,
        resumeData,
        questions: fallbackQuestions
      })
    }
  } catch (error) {
    console.error('Interview preparation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to prepare interview' },
      { status: 500 }
    )
  }
}

function generateFallbackQuestions(resumeData, jobTitle) {
  const questions = []
  
  // Project-based questions
  if (resumeData.projects && resumeData.projects.length > 0) {
    resumeData.projects.slice(0, 5).forEach(project => {
      questions.push(`Tell me about your project "${project.name || project.title || 'this project'}". What was your role and what technologies did you use?`)
    })
  }
  
  // Skill-based questions
  if (resumeData.skills && resumeData.skills.length > 0) {
    resumeData.skills.slice(0, 5).forEach(skill => {
      questions.push(`How have you used ${skill} in your previous projects?`)
    })
  }
  
  // Experience-based questions
  if (resumeData.experience && resumeData.experience.length > 0) {
    resumeData.experience.slice(0, 5).forEach(exp => {
      questions.push(`Can you describe your experience at ${exp.company || 'your previous company'}? What were your key achievements?`)
    })
  }
  
  // Fill remaining with generic questions
  const genericQuestions = [
    'Tell me about yourself and your background.',
    'Why are you interested in this position?',
    'What are your greatest strengths?',
    'Describe a challenging project you worked on.',
    'How do you handle tight deadlines?',
    'What are your career goals?',
    'Tell me about a time you solved a difficult problem.',
    'How do you stay updated with industry trends?',
    'What motivates you in your work?',
    'Do you have any questions for us?'
  ]
  
  while (questions.length < 20) {
    const q = genericQuestions[questions.length % genericQuestions.length]
    if (!questions.includes(q)) {
      questions.push(q)
    } else {
      questions.push(`${q} (Please elaborate)`)
    }
  }
  
  return questions.slice(0, 20)
}

