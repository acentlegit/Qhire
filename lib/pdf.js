import PDFDocument from 'pdfkit'

/**
 * Generate PDF for offer letter
 * @param {Object} offer - Offer object with application, candidate, job
 * @param {Object} template - Offer template (optional)
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateOfferPDF(offer, template = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const chunks = []
      
      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const candidate = offer.application?.candidate || {}
      const job = offer.application?.job || {}
      
      // Header
      doc.fontSize(20).text('Job Offer Letter', { align: 'center' })
      doc.moveDown()
      
      // Date
      doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`)
      doc.moveDown()
      
      // Candidate info
      doc.fontSize(14).text(`Dear ${candidate.name || 'Candidate'},`, { continued: false })
      doc.moveDown()
      
      // Offer content
      let content = template?.content || generateDefaultOfferContent(offer)
      
      // Replace variables if template exists
      if (template) {
        content = replaceTemplateVariables(content, {
          candidateName: candidate.name || 'Candidate',
          jobTitle: job.title || 'Position',
          salary: offer.salary ? new Intl.NumberFormat('en-US', { style: 'currency', currency: offer.currency || 'USD' }).format(offer.salary) : 'TBD',
          currency: offer.currency || 'USD',
          startDate: offer.startDate ? new Date(offer.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD',
          benefits: Array.isArray(offer.benefits) ? offer.benefits.join(', ') : (offer.benefits || 'Standard benefits package'),
          terms: offer.terms || 'Standard terms and conditions apply',
          companyName: 'QHire'
        })
      }
      
      // Remove HTML tags for PDF
      content = content.replace(/<[^>]*>/g, '')
      
      // Add content
      doc.fontSize(11).text(content, {
        align: 'left',
        lineGap: 5
      })
      
      doc.moveDown(2)
      
      // Signature line
      doc.fontSize(11).text('Sincerely,', { continued: false })
      doc.moveDown(2)
      doc.text('QHire Team')
      
      // Footer
      doc.fontSize(8)
        .text('This is an automated offer letter. Please contact us for any questions.', 50, doc.page.height - 50, {
          align: 'center',
          width: doc.page.width - 100
        })
      
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

function generateDefaultOfferContent(offer) {
  const candidate = offer.application?.candidate || {}
  const job = offer.application?.job || {}
  const salary = offer.salary ? new Intl.NumberFormat('en-US', { style: 'currency', currency: offer.currency || 'USD' }).format(offer.salary) : 'TBD'
  const startDate = offer.startDate ? new Date(offer.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'
  
  return `We are pleased to extend an offer for the position of ${job.title || 'Position'} at QHire.

Position: ${job.title || 'Position'}
Salary: ${salary}
Start Date: ${startDate}
${offer.benefits ? `Benefits: ${Array.isArray(offer.benefits) ? offer.benefits.join(', ') : offer.benefits}` : ''}

${offer.terms || 'Standard terms and conditions apply.'}

We look forward to welcoming you to our team!`
}

function replaceTemplateVariables(content, variables) {
  let result = content
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, variables[key])
  })
  return result
}

