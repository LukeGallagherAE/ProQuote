const express    = require('express');
const router     = express.Router();
const { PDFDocument, rgb } = require('pdf-lib');
const db         = require('../db');

async function generatePDF(html) {
  const puppeteer = require('puppeteer');
  const { execSync } = require('child_process');
  const launchOpts = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  };
  // Explicit env var takes priority, then auto-detect system chromium
  if (process.env.CHROME_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.CHROME_EXECUTABLE_PATH;
  } else {
    try {
      launchOpts.executablePath = execSync('which chromium || which chromium-browser || which google-chrome-stable || which google-chrome', {encoding:'utf8'}).trim();
    } catch(e) {}
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
    // Fetch T&C PDF and company logo in parallel
    const [tcResult, logoResult] = await Promise.all([
      db.query("SELECT value FROM settings WHERE key = 'proquote_tc_pdf' AND user_id = $1", [userId]),
      db.query("SELECT value FROM settings WHERE key = 'proquote_logo'  AND user_id = $1", [userId]),
    ]);

    if (!tcResult.rows.length || !tcResult.rows[0].value) return pdfBuffer;

    const tcBase64 = tcResult.rows[0].value
      .replace(/^"?data:application\/pdf;base64,/, '')
      .replace(/"$/, '');

    const quotePdfDoc = await PDFDocument.load(pdfBuffer);
    const tcPdfDoc    = await PDFDocument.load(Buffer.from(tcBase64, 'base64'));
    const mergedDoc   = await PDFDocument.create();

    // Copy quote pages first
    const quotePages = await mergedDoc.copyPages(quotePdfDoc, quotePdfDoc.getPageIndices());
    quotePages.forEach(p => mergedDoc.addPage(p));

    // Copy T&C pages
    const tcPages = await mergedDoc.copyPages(tcPdfDoc, tcPdfDoc.getPageIndices());
    tcPages.forEach(p => mergedDoc.addPage(p));

    // Watermark each T&C page with the company logo
    if (logoResult.rows.length && logoResult.rows[0].value) {
      try {
        const raw = logoResult.rows[0].value.replace(/^"/, '').replace(/"$/, '');
        const isPng  = raw.startsWith('data:image/png');
        const isJpeg = raw.startsWith('data:image/jpeg') || raw.startsWith('data:image/jpg');

        if (isPng || isJpeg) {
          const logoBase64 = raw.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
          const logoBytes  = Buffer.from(logoBase64, 'base64');

          const logoImage = isPng
            ? await mergedDoc.embedPng(logoBytes)
            : await mergedDoc.embedJpg(logoBytes);

          const { width: imgW, height: imgH } = logoImage.size();

          for (const page of tcPages) {
            const { width, height } = page.getSize();
            // Scale logo to ~45% page width, centred
            const scale  = Math.min((width * 0.45) / imgW, (height * 0.3) / imgH);
            const drawW  = imgW * scale;
            const drawH  = imgH * scale;
            page.drawImage(logoImage, {
              x:       (width  - drawW) / 2,
              y:       (height - drawH) / 2,
              width:   drawW,
              height:  drawH,
              opacity: 0.07,   // very subtle — visible but not intrusive
            });
          }
        }
      } catch (wErr) {
        console.error('[PDF] Logo watermark failed (non-fatal):', wErr.message);
      }
    }

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
