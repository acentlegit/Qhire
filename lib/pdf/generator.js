/**
 * PDF Generator Service
 * Generates PDF documents for offer letters and reports
 */

import PDFDocument from 'pdfkit'

/**
 * Generate offer letter PDF
 * @param {Object} data - Offer data
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateOfferLetterPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      })

      const chunks = []
      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Company header
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text(data.companyName || 'Company Name', { align: 'center' })
      
      doc.moveDown()
      doc.fontSize(10)
         .font('Helvetica')
         .text(data.companyAddress || '', { align: 'center' })
      
      doc.moveDown(2)

      // Date
      doc.fontSize(11)
         .text(`Date: ${formatDate(data.date || new Date())}`, { align: 'right' })
      
      doc.moveDown(2)

      // Candidate address
      doc.text(data.candidateName || 'Candidate Name')
      if (data.candidateAddress) {
        doc.text(data.candidateAddress)
      }
      
      doc.moveDown(2)

      // Subject
      doc.font('Helvetica-Bold')
         .text(`Subject: Offer of Employment - ${data.jobTitle || 'Position'}`)
      
      doc.moveDown()
      doc.font('Helvetica')

      // Greeting
      doc.text(`Dear ${data.candidateName || 'Candidate'},`)
      doc.moveDown()

      // Opening paragraph
      doc.text(
        `We are pleased to extend an offer of employment for the position of ${data.jobTitle || 'Position'} ` +
        `at ${data.companyName || 'our company'}. We believe your skills and experience will be a valuable addition to our team.`,
        { align: 'justify' }
      )
      doc.moveDown()

      // Position details
      doc.font('Helvetica-Bold').text('Position Details:')
      doc.font('Helvetica')
      doc.moveDown(0.5)

      const details = [
        ['Position:', data.jobTitle || 'N/A'],
        ['Department:', data.department || 'N/A'],
        ['Reporting To:', data.reportingTo || 'N/A'],
        ['Start Date:', formatDate(data.startDate) || 'TBD'],
        ['Employment Type:', data.employmentType || 'Full-time'],
      ]

      details.forEach(([label, value]) => {
        doc.text(`${label} ${value}`)
      })

      doc.moveDown()

      // Compensation
      doc.font('Helvetica-Bold').text('Compensation:')
      doc.font('Helvetica')
      doc.moveDown(0.5)

      if (data.salary) {
        const formattedSalary = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: data.currency || 'USD',
          maximumFractionDigits: 0,
        }).format(data.salary)
        
        doc.text(`Annual Salary: ${formattedSalary}`)
      }

      if (data.bonus) {
        doc.text(`Signing Bonus: ${data.bonus}`)
      }

      doc.moveDown()

      // Benefits
      if (data.benefits && data.benefits.length > 0) {
        doc.font('Helvetica-Bold').text('Benefits:')
        doc.font('Helvetica')
        doc.moveDown(0.5)

        const benefitsList = Array.isArray(data.benefits) 
          ? data.benefits 
          : data.benefits.split(',').map(b => b.trim())

        benefitsList.forEach(benefit => {
          doc.text(`• ${benefit}`)
        })
        doc.moveDown()
      }

      // Terms
      if (data.terms) {
        doc.font('Helvetica-Bold').text('Additional Terms:')
        doc.font('Helvetica')
        doc.moveDown(0.5)
        doc.text(data.terms, { align: 'justify' })
        doc.moveDown()
      }

      // Acceptance deadline
      if (data.expiresAt) {
        doc.text(
          `Please respond to this offer by ${formatDate(data.expiresAt)}. ` +
          `If we do not receive a response by this date, the offer will be considered withdrawn.`,
          { align: 'justify' }
        )
        doc.moveDown()
      }

      // Closing
      doc.text(
        'We are excited about the possibility of you joining our team. If you have any questions, ' +
        'please do not hesitate to reach out.',
        { align: 'justify' }
      )
      doc.moveDown(2)

      doc.text('Sincerely,')
      doc.moveDown(2)

      doc.text(data.signerName || 'HR Department')
      doc.text(data.signerTitle || 'Human Resources')
      doc.text(data.companyName || '')

      // Signature section
      doc.moveDown(3)
      doc.moveTo(50, doc.y).lineTo(250, doc.y).stroke()
      doc.moveDown(0.5)
      doc.text('Candidate Signature', 50)
      doc.moveDown()
      doc.text('Date: ________________')

      // Footer
      const pageHeight = doc.page.height
      doc.fontSize(8)
         .text(
           'This offer letter is confidential and intended solely for the named recipient.',
           50,
           pageHeight - 50,
           { align: 'center' }
         )

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Generate report PDF
 * @param {Object} data - Report data
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateReportPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      })

      const chunks = []
      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Title
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text(data.title || 'Report', { align: 'center' })
      
      doc.moveDown()
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Generated: ${formatDate(new Date())}`, { align: 'center' })
      
      doc.moveDown(2)

      // Content sections
      if (data.sections && Array.isArray(data.sections)) {
        data.sections.forEach(section => {
          doc.font('Helvetica-Bold')
             .fontSize(14)
             .text(section.title || '')
          
          doc.moveDown(0.5)
          doc.font('Helvetica')
             .fontSize(11)
             .text(section.content || '', { align: 'justify' })
          
          doc.moveDown()
        })
      }

      // Table data
      if (data.table && data.table.headers && data.table.rows) {
        drawTable(doc, data.table)
      }

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Draw a simple table in the PDF
 */
function drawTable(doc, table) {
  const startX = 50
  const startY = doc.y
  const cellPadding = 5
  const columnWidth = (doc.page.width - 100) / table.headers.length

  // Draw headers
  doc.font('Helvetica-Bold').fontSize(10)
  let y = startY

  table.headers.forEach((header, i) => {
    doc.text(header, startX + (i * columnWidth), y, {
      width: columnWidth - cellPadding,
    })
  })

  y += 20
  doc.moveTo(startX, y).lineTo(doc.page.width - 50, y).stroke()
  y += 5

  // Draw rows
  doc.font('Helvetica').fontSize(9)
  
  table.rows.forEach(row => {
    const rowHeight = 15
    
    row.forEach((cell, i) => {
      doc.text(String(cell), startX + (i * columnWidth), y, {
        width: columnWidth - cellPadding,
      })
    })
    
    y += rowHeight
    
    // Check for page break
    if (y > doc.page.height - 100) {
      doc.addPage()
      y = 50
    }
  })
}

/**
 * Format date for display
 */
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Generate simple text PDF
 */
export async function generateTextPDF(title, content) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      })

      const chunks = []
      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text(title, { align: 'center' })
      
      doc.moveDown(2)
      doc.fontSize(11)
         .font('Helvetica')
         .text(content, { align: 'justify' })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

