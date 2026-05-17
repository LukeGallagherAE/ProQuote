const express    = require('express');
const router     = express.Router();
const path       = require('path');
const fs         = require('fs');
const db         = require('../db');
const { Resend } = require('resend');
const { mergeTCPdf } = require('./pdf');

const LOGO_PATH = path.join(__dirname, '../public/logo.png');

async function generatePDF(html) {
  const puppeteer = require('puppeteer');
  const launchOpts = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
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

function buildSignatureHTML() {
  // Use the publicly-accessible logo URL on Railway, fall back to text only
  const logoUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/logo.png`
    : null;

  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,Arial,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.6">
  ${logoUrl ? `<tr><td style="padding-bottom:10px"><img src="${logoUrl}" alt="Adonai Electrical" style="height:56px;display:block"></td></tr>` : ''}
  <tr><td><strong>Luke Gallagher</strong> - Director | Licensed Electrician</td></tr>
  <tr><td><strong>Mobile:</strong> 0407 769 296</td></tr>
  <tr><td><strong>Email:</strong> <a href="mailto:Luke@adonaielectrical.com" style="color:#1a1a1a">Luke@adonaielectrical.com</a></td></tr>
  <tr><td><strong>Site:</strong> <a href="http://www.adonaielectrical.com" style="color:#1a1a1a">www.adonaielectrical.com</a></td></tr>
</table>`;
}

function buildHTMLEmail(bodyText) {
  const paragraphs = (bodyText || '')
    .split('\n')
    .map(line => line.trim() ? `<p style="margin:0 0 10px">${line}</p>` : '<br>')
    .join('\n  ');

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.7;margin:0;padding:20px">
  ${paragraphs}
  <br>
  ${buildSignatureHTML()}
</body>
</html>`;
}

// POST /api/email
router.post('/', async (req, res) => {
  const { to, subject: customSubject, body: customBody, clientName, jobName, jobNumber, ref, siteAddr, html } = req.body || {};

  if (!to)   return res.status(400).json({ error: 'No recipient email address' });
  if (!html) return res.status(400).json({ error: 'No quote HTML provided' });

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not set — add it in Railway Variables' });
  }

  const subject = customSubject || ['Quote', ref, jobName ? '— ' + jobName : ''].filter(Boolean).join(' ');

  try {
    let pdf = await generatePDF(html);

    // Append T&C PDF (with logo watermark) if the user has one stored
    pdf = await mergeTCPdf(pdf, req.user.userId);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = `Adonai Electrical <${process.env.GMAIL_USER || 'Luke@adonaielectrical.com'}>`;
    const pdfFilename = [ref || 'Quote', clientName].filter(Boolean).join(' - ') + '.pdf';

    // Send quote to client
    const { error: sendErr } = await resend.emails.send({
      from:        fromAddress,
      to:          [to],
      subject,
      html:        buildHTMLEmail(customBody),
      text:        customBody || '',
      attachments: [{ filename: pdfFilename, content: pdf }],
    });

    if (sendErr) throw new Error(sendErr.message || JSON.stringify(sendErr));

    // Confirmation email to self
    const sentAt = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'short', timeStyle: 'short' });
    const confirmRows = [
      ['Sent to',    to],
      ['Client',     clientName  || '—'],
      ['Job name',   jobName     || '—'],
      ['Job number', jobNumber   || '—'],
      ['Quote ref',  ref         || '—'],
      ['Site',       siteAddr    || '—'],
      ['Subject',    subject],
      ['Sent at',    sentAt],
    ].map(([label, val]) =>
      `<tr><td style="padding:6px 12px;font-weight:600;white-space:nowrap;color:#555">${label}</td><td style="padding:6px 12px">${val}</td></tr>`
    ).join('');

    await resend.emails.send({
      from:    fromAddress,
      to:      [process.env.GMAIL_USER || 'Luke@adonaielectrical.com'],
      subject: `✅ Quote sent — ${ref || ''}${jobName ? ' — ' + jobName : ''}`,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,Arial,sans-serif;font-size:14px;color:#1a1a1a;padding:20px">
        <p style="margin:0 0 16px"><strong>Quote successfully sent.</strong></p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
          ${confirmRows}
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#888">Sent via ProQuote</p>
      </body></html>`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Email send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
