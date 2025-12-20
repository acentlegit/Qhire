import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth.js'
import { aiProvider } from '../../../../../lib/ai/provider.js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/interview/analyze
 * Analyze a single interview answer
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { question, answer, jobTitle } = await req.json()

    if (!question || !answer) {
      return NextResponse.json({
        score: 5,
        feedback: 'Answer recorded'
      })
    }

    const prompt = `You are an expert interview evaluator. Analyze this interview answer.

Job: ${jobTitle || 'General Position'}
Question: ${question}
Answer: ${answer}

Provide a JSON response with:
- score (1-10): How well did they answer?
- feedback (string): Brief constructive feedback (1 sentence)

Be fair and constructive. JSON only:`

    try {
      const response = await aiProvider.chat([
        { role: 'system', content: 'You are an interview evaluator. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        max_tokens: 200
      })

      // Parse response
      let result
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : null
      } catch {
        result = null
      }

      return NextResponse.json({
        score: result?.score || 7,
        feedback: result?.feedback || 'Answer recorded successfully'
      })
    } catch (aiError) {
      console.error('AI analysis error:', aiError)
      return NextResponse.json({
        score: 7,
        feedback: 'Answer recorded'
      })
    }
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({
      score: 5,
      feedback: 'Answer recorded'
    })
  }
}

