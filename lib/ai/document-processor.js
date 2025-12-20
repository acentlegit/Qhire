/**
 * Enhanced Document Processor
 * Features from LLM Project: OCR, chunking, aggregation
 */

import Tesseract from 'tesseract.js'

/**
 * OCR - Extract text from image-based PDFs or images
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} [language='eng'] - OCR language
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextWithOCR(imageBuffer, language = 'eng') {
  try {
    console.log('🔍 Starting OCR extraction...')
    
    const result = await Tesseract.recognize(
      imageBuffer,
      language,
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
          }
        }
      }
    )
    
    const text = result.data.text
    console.log(`✅ OCR extracted ${text.length} characters`)
    
    return text
  } catch (error) {
    console.error('OCR extraction error:', error)
    throw new Error(`OCR failed: ${error.message}`)
  }
}

/**
 * Chunk text into smaller pieces for processing
 * Useful for large documents that exceed token limits
 * @param {string} text - Full text
 * @param {Object} options - Chunking options
 * @returns {Array<{text: string, index: number, start: number, end: number}>}
 */
export function chunkText(text, options = {}) {
  const {
    maxChunkSize = 4000,    // Max characters per chunk
    overlap = 200,          // Overlap between chunks for context
    splitOn = ['\n\n', '\n', '. ', ' '] // Split priorities
  } = options
  
  if (!text || text.length <= maxChunkSize) {
    return [{ text, index: 0, start: 0, end: text?.length || 0 }]
  }
  
  const chunks = []
  let currentPosition = 0
  let chunkIndex = 0
  
  while (currentPosition < text.length) {
    let endPosition = Math.min(currentPosition + maxChunkSize, text.length)
    
    // If not at the end, find a good split point
    if (endPosition < text.length) {
      let splitFound = false
      
      // Try each split pattern in order of preference
      for (const splitter of splitOn) {
        const searchStart = currentPosition + maxChunkSize - overlap
        const searchEnd = currentPosition + maxChunkSize
        const searchText = text.substring(searchStart, searchEnd)
        const lastSplitIndex = searchText.lastIndexOf(splitter)
        
        if (lastSplitIndex !== -1) {
          endPosition = searchStart + lastSplitIndex + splitter.length
          splitFound = true
          break
        }
      }
      
      // If no good split found, just cut at maxChunkSize
      if (!splitFound) {
        endPosition = currentPosition + maxChunkSize
      }
    }
    
    const chunkText = text.substring(currentPosition, endPosition).trim()
    
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        start: currentPosition,
        end: endPosition
      })
      chunkIndex++
    }
    
    // Move position with overlap for context continuity
    currentPosition = endPosition - overlap
    if (currentPosition >= text.length - overlap) {
      break
    }
  }
  
  console.log(`📄 Split text into ${chunks.length} chunks`)
  return chunks
}

/**
 * Aggregate results from multiple chunk analyses
 * @param {Array<Object>} chunkResults - Results from analyzing each chunk
 * @returns {Object} Aggregated result
 */
export function aggregateResults(chunkResults) {
  if (!chunkResults || chunkResults.length === 0) {
    return null
  }
  
  if (chunkResults.length === 1) {
    return chunkResults[0]
  }
  
  // Aggregate resume-specific fields
  const aggregated = {
    name: null,
    email: null,
    phone: null,
    skills: [],
    experience: [],
    education: [],
    currentCompany: null,
    currentRole: null,
    yearsExperience: null,
    summary: null
  }
  
  for (const result of chunkResults) {
    // Take first non-null value for single fields
    if (!aggregated.name && result.name) aggregated.name = result.name
    if (!aggregated.email && result.email) aggregated.email = result.email
    if (!aggregated.phone && result.phone) aggregated.phone = result.phone
    if (!aggregated.currentCompany && result.currentCompany) aggregated.currentCompany = result.currentCompany
    if (!aggregated.currentRole && result.currentRole) aggregated.currentRole = result.currentRole
    if (!aggregated.yearsExperience && result.yearsExperience) aggregated.yearsExperience = result.yearsExperience
    if (!aggregated.summary && result.summary) aggregated.summary = result.summary
    
    // Merge arrays (deduplicate skills)
    if (result.skills && Array.isArray(result.skills)) {
      for (const skill of result.skills) {
        if (!aggregated.skills.includes(skill)) {
          aggregated.skills.push(skill)
        }
      }
    }
    
    // Merge experience (deduplicate by company+role)
    if (result.experience && Array.isArray(result.experience)) {
      for (const exp of result.experience) {
        const exists = aggregated.experience.some(e => 
          e.company === exp.company && e.role === exp.role
        )
        if (!exists) {
          aggregated.experience.push(exp)
        }
      }
    }
    
    // Merge education (deduplicate by institution+degree)
    if (result.education && Array.isArray(result.education)) {
      for (const edu of result.education) {
        const exists = aggregated.education.some(e => 
          e.institution === edu.institution && e.degree === edu.degree
        )
        if (!exists) {
          aggregated.education.push(edu)
        }
      }
    }
  }
  
  console.log(`📊 Aggregated results from ${chunkResults.length} chunks`)
  return aggregated
}

/**
 * Check if a PDF might be image-based (scanned)
 * @param {string} extractedText - Text extracted from PDF
 * @returns {boolean} True if likely image-based
 */
export function isLikelyImageBasedPDF(extractedText) {
  if (!extractedText) return true
  
  // If very little text extracted, likely image-based
  if (extractedText.trim().length < 100) return true
  
  // If mostly gibberish characters, likely OCR needed
  const alphanumericRatio = (extractedText.match(/[a-zA-Z0-9]/g) || []).length / extractedText.length
  if (alphanumericRatio < 0.5) return true
  
  return false
}

/**
 * Convert PDF page to image for OCR
 * Note: This requires pdf-poppler or similar for full implementation
 * For now, we'll handle image files directly
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {number} pageNumber - Page number (1-indexed)
 * @returns {Promise<Buffer>} Image buffer
 */
export async function pdfPageToImage(pdfBuffer, pageNumber = 1) {
  // This would require a native PDF renderer like pdf-poppler
  // For now, throw an error with instructions
  throw new Error(
    'PDF to image conversion requires additional setup. ' +
    'For scanned PDFs, please convert to images first or use a PDF with selectable text.'
  )
}

/**
 * Process document with intelligent chunking and OCR fallback
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimeType - MIME type
 * @param {Object} options - Processing options
 * @returns {Promise<{text: string, chunks: Array, usedOCR: boolean}>}
 */
export async function processDocument(fileBuffer, mimeType, options = {}) {
  const { extractResumeText } = await import('./resume-parser.js')
  
  let text = ''
  let usedOCR = false
  
  // Handle image files with OCR
  if (mimeType.startsWith('image/')) {
    console.log('📷 Image file detected, using OCR...')
    text = await extractTextWithOCR(fileBuffer, options.language)
    usedOCR = true
  } else {
    // Try standard text extraction first
    try {
      text = await extractResumeText(fileBuffer, mimeType)
      
      // Check if OCR might be needed
      if (isLikelyImageBasedPDF(text)) {
        console.log('⚠️ PDF appears to be image-based, text extraction limited')
        // Note: Full OCR for PDFs would require pdf-poppler or similar
      }
    } catch (error) {
      console.error('Standard extraction failed:', error.message)
      throw error
    }
  }
  
  // Chunk the text if needed
  const chunks = chunkText(text, options.chunking)
  
  return {
    text,
    chunks,
    usedOCR,
    charCount: text.length,
    chunkCount: chunks.length
  }
}

export default {
  extractTextWithOCR,
  chunkText,
  aggregateResults,
  isLikelyImageBasedPDF,
  processDocument
}

