/**
 * Resume Parser Service
 * Extracts structured data from resumes using AI (OpenAI/LLM Core Services)
 * Enhanced with OCR, chunking, and aggregation from LLM Project
 */

import aiProvider from './provider.js'
import { trackAIUsage } from './usage-tracker.js'
import mammoth from 'mammoth'
import { chunkText, aggregateResults, extractTextWithOCR, isLikelyImageBasedPDF } from './document-processor.js'

/**
 * Extract text from PDF file
 */
async function extractTextFromPDF(buffer) {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('PDF buffer is empty')
    }
    
    console.log('Attempting to parse PDF, buffer size:', buffer.length)
    
    // pdf-parse v2.x uses a class-based API
    let PDFParse
    try {
      // Use dynamic import (works in Next.js App Router)
      const pdfParseModule = await import('pdf-parse')
      
      console.log('pdf-parse module keys:', Object.keys(pdfParseModule))
      
      // pdf-parse v2.x exports PDFParse class
      PDFParse = pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse
      
      if (!PDFParse || typeof PDFParse !== 'function') {
        console.error('pdf-parse module structure:', Object.keys(pdfParseModule))
        throw new Error('PDFParse class not found in pdf-parse module. Available exports: ' + JSON.stringify(Object.keys(pdfParseModule)))
      }
      
      console.log('PDFParse class imported successfully')
    } catch (importError) {
      console.error('Import error details:', {
        message: importError.message,
        stack: importError.stack,
        code: importError.code,
        name: importError.name
      })
      throw new Error(`Failed to import pdf-parse: ${importError.message}. Make sure pdf-parse is installed: npm install pdf-parse`)
    }
    
    console.log('Creating PDFParse instance with buffer...')
    
    // pdf-parse v2.x API: Create instance with data parameter (not buffer)
    // According to docs: new PDFParse({ data: buffer })
    let parser
    try {
      // Convert Buffer to Uint8Array if needed (better for memory)
      const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
      parser = new PDFParse({ data })
      console.log('PDFParse instance created successfully with data parameter')
    } catch (constructorError) {
      console.error('Error creating PDFParse instance:', constructorError)
      console.error('Constructor error stack:', constructorError.stack)
      throw new Error(`Failed to create PDFParse instance: ${constructorError.message}`)
    }
    
    console.log('Extracting text from PDF...')
    
    // Extract text using the new API
    let result
    try {
      result = await parser.getText()
      console.log('getText() completed, result type:', typeof result)
      console.log('Result keys:', result ? Object.keys(result) : 'null')
    } catch (getTextError) {
      console.error('Error calling getText():', getTextError)
      // Clean up parser
      try {
        await parser.destroy()
      } catch (destroyError) {
        console.error('Error destroying parser:', destroyError)
      }
      throw new Error(`Failed to extract text: ${getTextError.message}`)
    }
    
    // Clean up parser
    try {
      await parser.destroy()
    } catch (destroyError) {
      console.warn('Error destroying parser (non-critical):', destroyError)
    }
    
    console.log('PDF parsed successfully, extracted text length:', result?.text?.length || 0)
    
    if (!result) {
      throw new Error('pdf-parse returned no result')
    }
    
    // Check for text in different possible locations
    let text = result.text || result.pageText || (result.pages && result.pages.map(p => p.text).join('\n'))
    
    if (!text || text.trim().length === 0) {
      console.warn('PDF parsed but no text extracted. Result structure:', JSON.stringify(Object.keys(result || {})))
      throw new Error('No text extracted from PDF. The PDF might be image-only or scanned. Please use a PDF with selectable text.')
    }
    
    return text
  } catch (error) {
    console.error('Error parsing PDF:', error)
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Buffer length:', buffer?.length)
    
    // Provide more helpful error messages
    if (error.message.includes('No text extracted')) {
      throw error // Re-throw as-is with original message
    } else if (error.message.includes('Failed to import') || error.message.includes('not found')) {
      throw new Error(`PDF parsing library error: ${error.message}. Please ensure pdf-parse is installed: npm install pdf-parse`)
    } else {
      throw new Error(`Failed to parse PDF file: ${error.message}`)
    }
  }
}

/**
 * Extract text from DOCX file (new Word format)
 */
async function extractTextFromDOCX(buffer) {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('DOCX buffer is empty')
    }
    
    const result = await mammoth.extractRawText({ buffer })
    
    if (!result || !result.value) {
      throw new Error('No text extracted from DOCX')
    }
    
    return result.value
  } catch (error) {
    console.error('Error parsing DOCX:', error)
    console.error('Buffer length:', buffer?.length)
    throw new Error(`Failed to parse DOCX file: ${error.message}`)
  }
}

/**
 * Extract text from DOC file (old Word format)
 * Note: mammoth only works with DOCX. For DOC files, we need a different approach.
 */
async function extractTextFromDOC(buffer) {
  try {
    if (!buffer || buffer.length === 0) {
      throw new Error('DOC buffer is empty')
    }
    
    // mammoth only works with DOCX (XML-based), not DOC (binary format)
    // Try to parse as DOCX first (sometimes files are mislabeled)
    try {
      const result = await mammoth.extractRawText({ buffer })
      if (result && result.value) {
        return result.value
      }
    } catch (mammothError) {
      // If mammoth fails, it's likely a real DOC file
      console.warn('mammoth failed to parse DOC file, likely old binary format:', mammothError.message)
    }
    
    // For old DOC files, we would need a library like 'textract' or 'antiword'
    // For now, provide a helpful error message
    throw new Error(
      'Old .doc format (binary) is not supported. ' +
      'Please convert the file to .docx or .pdf format. ' +
      'You can do this by opening the file in Microsoft Word and saving as .docx or .pdf.'
    )
  } catch (error) {
    console.error('Error parsing DOC:', error)
    throw error // Re-throw with original message
  }
}

/**
 * Extract text from resume file based on MIME type
 */
export async function extractResumeText(fileBuffer, mimeType) {
  console.log('Extracting text from resume, mimeType:', mimeType, 'buffer length:', fileBuffer?.length)
  
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File buffer is empty or invalid')
  }
  
  // Handle image files with OCR
  if (mimeType.startsWith('image/')) {
    console.log('📷 Image file detected, using OCR...')
    return await extractTextWithOCR(fileBuffer)
  }
  
  if (mimeType === 'application/pdf') {
    const text = await extractTextFromPDF(fileBuffer)
    
    // Check if PDF might be image-based (scanned)
    if (isLikelyImageBasedPDF(text)) {
      console.log('⚠️ PDF appears to be image-based with limited text. Consider using a PDF with selectable text.')
    }
    
    return text
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // New Word format (.docx)
    return await extractTextFromDOCX(fileBuffer)
  } else if (mimeType === 'application/msword') {
    // Old Word format (.doc) - try DOCX first (sometimes mislabeled), then handle as DOC
    try {
      return await extractTextFromDOCX(fileBuffer)
    } catch (error) {
      // If DOCX parsing fails, it's likely a real DOC file
      if (error.message.includes('Could not find the body element') || 
          error.message.includes('are you sure this is a docx file')) {
        return await extractTextFromDOC(fileBuffer)
      }
      throw error
    }
  } else {
    throw new Error(`Unsupported file type: ${mimeType}. Supported types: PDF, DOC, DOCX, Images (JPG, PNG)`)
  }
}

/**
 * Parse resume text using OpenAI
 * @param {string} resumeText - Resume text
 * @param {string} [userId] - User ID for usage tracking
 * @returns {Promise<Object>} Parsed resume data
 */
async function parseWithOpenAI(resumeText, userId = 'system') {
  // Check if provider is configured
  const provider = process.env.AI_PROVIDER || 'openai'
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in .env')
  }
  if (provider === 'llm-core' && !process.env.LLM_CORE_URL) {
    throw new Error('LLM Core Services URL not configured. Set LLM_CORE_URL in .env')
  }

  const prompt = `Extract the following information from this resume and return ONLY valid JSON (no markdown, no code blocks):

{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "company": "Company name",
      "role": "Job title",
      "duration": "Start date - End date",
      "description": "Job description"
    }
  ],
  "education": [
    {
      "institution": "School/University name",
      "degree": "Degree name",
      "year": "Graduation year"
    }
  ],
  "currentCompany": "Current company if mentioned",
  "currentRole": "Current role if mentioned",
  "yearsExperience": "Total years of experience (number)"
}

Resume text:
${resumeText.substring(0, 15000)} // Limit to avoid token limits

Return ONLY the JSON object, no other text.`

  try {
    // Get model based on provider
    const model = process.env.AI_PROVIDER === 'llm-core'
      ? (process.env.LLM_CORE_MODEL || 'llama-3-8b')
      : (process.env.OPENAI_MODEL || 'gpt-4o-mini')

    const response = await aiProvider.chatCompletion({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a resume parsing expert. Extract structured data from resumes and return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 3000 // Increased to handle longer resumes
    })

    const content = response.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Parse JSON response
    let parsed
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON')
      console.error('Response content (first 500 chars):', content.substring(0, 500))
      console.error('Parse error:', parseError.message)
      
      // Try to extract JSON from the response if it's embedded in text
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0])
          console.log('Successfully extracted JSON from response')
        } catch (retryError) {
          throw new Error(`Invalid JSON response from AI. Response preview: ${content.substring(0, 200)}...`)
        }
      } else {
        throw new Error(`Invalid JSON response from AI. Response preview: ${content.substring(0, 200)}...`)
      }
    }

    // Track AI usage
    if (response.usage) {
      await trackAIUsage({
        userId,
        service: 'resume_parse',
        tokens: response.usage.total_tokens || 0,
        inputTokens: response.usage.prompt_tokens || 0,
        outputTokens: response.usage.completion_tokens || 0,
        model,
        metadata: { resumeLength: resumeText.length, provider: aiProvider.getProviderName() }
      })
    }

    // Calculate confidence score (simple heuristic)
    const confidence = calculateConfidence(parsed)

    return {
      ...parsed,
      confidence,
      rawText: resumeText.substring(0, 5000) // Store first 5000 chars
    }
  } catch (error) {
    console.error('OpenAI parsing error:', error)
    throw new Error(`Failed to parse resume: ${error.message}`)
  }
}

/**
 * Calculate confidence score based on extracted data quality
 */
function calculateConfidence(parsed) {
  let score = 0
  let maxScore = 0

  // Name (required)
  maxScore += 20
  if (parsed.name && parsed.name.length > 2) score += 20

  // Email (required)
  maxScore += 20
  if (parsed.email && parsed.email.includes('@')) score += 20

  // Skills
  maxScore += 15
  if (parsed.skills && Array.isArray(parsed.skills) && parsed.skills.length > 0) {
    score += Math.min(15, parsed.skills.length * 2)
  }

  // Experience
  maxScore += 25
  if (parsed.experience && Array.isArray(parsed.experience) && parsed.experience.length > 0) {
    score += Math.min(25, parsed.experience.length * 5)
  }

  // Education
  maxScore += 20
  if (parsed.education && Array.isArray(parsed.education) && parsed.education.length > 0) {
    score += Math.min(20, parsed.education.length * 5)
  }

  return Math.min(1, score / maxScore)
}

/**
 * Parse resume from file buffer
 * Enhanced with chunking for large documents
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimeType - File MIME type
 * @param {string} [userId] - User ID for usage tracking
 * @param {Object} [options] - Parsing options
 * @returns {Promise<Object>} Parsed resume data
 */
export async function parseResume(fileBuffer, mimeType, userId = 'system', options = {}) {
  try {
    // Step 1: Extract text from file
    const resumeText = await extractResumeText(fileBuffer, mimeType)

    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error('Resume text is too short or empty')
    }

    // Step 2: Check if chunking is needed (for very large resumes)
    const MAX_SINGLE_PARSE_LENGTH = 12000 // ~3000 tokens
    
    let parsed
    if (resumeText.length > MAX_SINGLE_PARSE_LENGTH && options.useChunking !== false) {
      console.log(`📄 Large resume detected (${resumeText.length} chars), using chunked parsing...`)
      parsed = await parseResumeWithChunking(resumeText, userId)
    } else {
      // Step 3: Parse with AI (single pass)
      parsed = await parseWithOpenAI(resumeText, userId)
    }

    return {
      ...parsed,
      resumeText: resumeText.substring(0, 10000), // Store first 10k chars
      parsedAt: new Date(),
      textLength: resumeText.length,
      usedChunking: resumeText.length > MAX_SINGLE_PARSE_LENGTH
    }
  } catch (error) {
    console.error('Resume parsing error:', error)
    throw error
  }
}

/**
 * Parse large resume using chunking and aggregation
 * @param {string} resumeText - Full resume text
 * @param {string} userId - User ID for tracking
 * @returns {Promise<Object>} Aggregated parsed data
 */
async function parseResumeWithChunking(resumeText, userId) {
  // Split into chunks
  const chunks = chunkText(resumeText, {
    maxChunkSize: 8000,  // ~2000 tokens per chunk
    overlap: 500         // Some overlap for context
  })
  
  console.log(`🔄 Processing ${chunks.length} chunks...`)
  
  const chunkResults = []
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`  Processing chunk ${i + 1}/${chunks.length} (${chunk.text.length} chars)`)
    
    try {
      // Add delay between chunks to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // 5 second delay
      }
      
      const result = await parseWithOpenAI(chunk.text, userId)
      chunkResults.push(result)
    } catch (error) {
      console.error(`  Error parsing chunk ${i + 1}:`, error.message)
      // Continue with other chunks
    }
  }
  
  if (chunkResults.length === 0) {
    throw new Error('Failed to parse any chunks of the resume')
  }
  
  // Aggregate results from all chunks
  const aggregated = aggregateResults(chunkResults)
  
  // Calculate overall confidence
  aggregated.confidence = calculateConfidence(aggregated)
  aggregated.chunksProcessed = chunkResults.length
  aggregated.totalChunks = chunks.length
  
  return aggregated
}

/**
 * Parse resume from URL (downloads file first)
 * @param {string} url - Resume file URL
 * @param {string} mimeType - File MIME type
 * @param {string} [userId] - User ID for usage tracking
 * @returns {Promise<Object>} Parsed resume data
 */
export async function parseResumeFromUrl(url, mimeType, userId = 'system') {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download resume: ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return await parseResume(buffer, mimeType, userId)
  } catch (error) {
    console.error('Error parsing resume from URL:', error)
    throw error
  }
}

