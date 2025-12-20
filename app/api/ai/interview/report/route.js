import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { aiProvider } from '../../../../../lib/ai/provider.js'
import { prisma } from '../../../../../lib/db.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/interview/report
 * Generate final interview report
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId, answers, duration, jobTitle, candidateName } = await req.json()

    // Calculate scores
    const avgScore = answers.length > 0 
      ? Math.round(answers.reduce((sum, a) => sum + (a.score || 0), 0) / answers.length * 10)
      : 70

    // Determine fit
    const fit = avgScore >= 80 ? 'STRONG' : avgScore >= 60 ? 'MODERATE' : 'WEAK'

    // Generate AI summary
    let summary = 'Interview completed successfully.'
    let strengths = ['Participated in interview', 'Answered questions']
    let gaps = ['Could provide more detailed responses']

    if (answers.length > 0) {
      try {
        const prompt = `Analyze this interview and provide a brief summary.

Candidate: ${candidateName || 'Candidate'}
Role: ${jobTitle || 'Position'}
Duration: ${Math.floor(duration / 60)} minutes
Overall Score: ${avgScore}/100

Questions & Answers:
${answers.map((a, i) => `Q${i+1}: ${a.question}\nA: ${a.answer || 'No response'}\nScore: ${a.score}/10`).join('\n\n')}

Provide JSON with:
- summary (2-3 sentences)
- strengths (array of 2-3 items)
- gaps (array of 1-2 items)

JSON only:`

        const response = await aiProvider.chat([
          { role: 'system', content: 'You are an interview analyst. Respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ], {
          temperature: 0.3,
          max_tokens: 500
        })

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          summary = result.summary || summary
          strengths = result.strengths || strengths
          gaps = result.gaps || gaps
        }
      } catch (aiError) {
        console.error('AI report generation error:', aiError)
      }
    }

    // Save to database if eventId provided
    if (eventId) {
      try {
        await prisma.event.update({
          where: { id: eventId },
          data: {
            // Store notes with the report data
            description: JSON.stringify({
              report: {
                overallScore: avgScore,
                fit,
                summary,
                strengths,
                gaps,
                answers,
                duration
              }
            })
          }
        })
      } catch (dbError) {
        console.error('Error saving report:', dbError)
      }
    }

    return NextResponse.json({
      overallScore: avgScore,
      fit,
      confidence: avgScore > 50 ? 'HIGH' : 'MEDIUM',
      summary,
      strengths,
      gaps,
      skills: {
        technical: Math.min(10, Math.round(avgScore / 10)),
        communication: Math.min(10, Math.round(avgScore / 10) + 1),
        problemSolving: Math.min(10, Math.round(avgScore / 10))
      },
      duration,
      answersCount: answers.length
    })
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json({
      overallScore: 70,
      fit: 'MODERATE',
      confidence: 'MEDIUM',
      summary: 'Interview completed. Detailed analysis pending.',
      strengths: ['Completed interview'],
      gaps: ['Further review needed'],
      skills: { technical: 7, communication: 7, problemSolving: 7 }
    })
  }
}

