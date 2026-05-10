const express    = require('express');
const router     = express.Router();
const { PDFDocument } = require('pdf-lib');
const db         = require('../db');

async function generatePDF(html) {
  const puppeteer = require('puppeteer');
  const launchOpts = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (process.env.CHROME_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.CHROME_EXECUTABLE_PATH;
  }
  const browser = await puppeteer.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '14mm', right: '14mm' },
    });
  } finally {
    await browser.close();
  }
}

async function mergeTCPdf(pdfBuffer, userId) {
  try {
    const { rows: tcRows } = await db.query(
      "SELECT value FROM settings WHERE key = 'proquote_tc_pdf' AND user_id = $1",
      [userId]
    );
    if (!tcRows.length || !tcRows[0].value) return pdfBuffer;

    const tcBase64 = tcRows[0].value
      .replace(/^"?data:application\/pdf;base64,/, '')
      .replace(/"$/, '');

    const quotePdfDoc = await PDFDocument.load(pdfBuffer);
    const tcPdfDoc    = await PDFDocument.load(Buffer.from(tcBase64, 'base64'));
    const mergedDoc   = await PDFDocument.create();

    const quotePages = await mergedDoc.copyPages(quotePdfDoc, quotePdfDoc.getPageIndices());
    quotePages.forEach(p => mergedDoc.addPage(p));

    const tcPages = await mergedDoc.copyPages(tcPdfDoc, tcPdfDoc.getPageIndices());
    tcPages.forEach(p => mergedDoc.addPage(p));

    const mergedPdf = await mergedDoc.save();
    return Buffer.from(mergedPdf);
  } catch (err) {
    console.error('[PDF] T&C merge failed, using original PDF:', err.message);
    return pdfBuffer;
  }
}

// POST /api/pdf/download
router.post('/download', async (req, res) => {
  const { html } = req.body || {};
  if (!html) return res.status(400).json({ error: 'No quote HTML provided' });

  try {
    let pdf = await generatePDF(html);
    pdf = await mergeTCPdf(pdf, req.user.userId);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="quote.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error('[PDF] download error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.mergeTCPdf = mergeTCPdf;
