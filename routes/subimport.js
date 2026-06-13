const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const Anthropic  = require('@anthropic-ai/sdk');
const db         = require('../db');
const requireAuth = require('../middleware/requireAuth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});

router.use(requireAuth);

// PUT /api/subimport/key — save Anthropic API key for this user
router.put('/key', async (req, res) => {
  const { key } = req.body || {};
  if (!key || !key.startsWith('sk-ant-')) {
    return res.status(400).json({ error: 'Invalid API key format — should start with sk-ant-' });
  }
  try {
    await db.query('UPDATE users SET anthropic_api_key = $1 WHERE id = $2', [key.trim(), req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/subimport/key:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/subimport/key — check whether a key is saved (never returns the key itself)
router.get('/key', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT anthropic_api_key IS NOT NULL AND anthropic_api_key <> \'\' AS has_key FROM users WHERE id = $1', [req.user.userId]);
    res.json({ hasKey: !!rows[0]?.has_key });
  } catch (err) {
    console.error('GET /api/subimport/key:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/subimport — upload PDF and extract line items via Claude
router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

  try {
    const { rows } = await db.query('SELECT anthropic_api_key FROM users WHERE id = $1', [req.user.userId]);
    const apiKey = rows[0]?.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'No Anthropic API key set — add it in Profile → AI Integration' });
    }

    const client = new Anthropic({ apiKey });
    const pdfBase64 = req.file.buffer.toString('base64');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: `You are extracting data from a subcontractor quote PDF.

Return ONLY a JSON object — no other text, no markdown, no explanation.

Format:
{
  "subName": "Company name from the quote header",
  "quoteRef": "Their quote or reference number",
  "items": [
    { "description": "Item description here", "cost": 1234.56 }
  ],
  "exclusions": ["Exclusion text 1", "Exclusion text 2"]
}

Rules:
- "subName": the name of the company that issued this quote (from their letterhead or header). Empty string if not found.
- "quoteRef": their quote number or reference (e.g. "QT-001", "Quote #2024-045"). Empty string if not found.
- Extract every individual line item that has a dollar price
- "cost" must be a plain number with no symbols or commas
- All prices should be ex-GST. If a price appears to include GST, divide by 1.1
- Skip rows that are subtotals, totals, or summaries
- If you see an "Exclusions", "Not Included", or "Allowances" section, list each point in "exclusions"
- If there are no exclusions, return an empty array
- Return valid JSON only`,
          },
        ],
      }],
    });

    const text = (response.content[0]?.text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'AI could not identify line items in this PDF. Check the file contains readable text.' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const items = (parsed.items || [])
      .filter(i => i.description && typeof i.cost === 'number' && i.cost >= 0)
      .map(i => ({ description: String(i.description).trim(), cost: Math.round(i.cost * 100) / 100 }));

    if (!items.length) {
      return res.status(422).json({ error: 'No priced line items found. The PDF may be a scanned image or contain no itemised pricing.' });
    }

    res.json({
      subName:    (parsed.subName   || '').trim(),
      quoteRef:   (parsed.quoteRef  || '').trim(),
      items,
      exclusions: parsed.exclusions || [],
    });
  } catch (err) {
    if (err.message?.includes('Only PDF')) return res.status(400).json({ error: err.message });
    console.error('POST /api/subimport:', err.message);
    res.status(500).json({ error: err.message || 'Failed to process PDF' });
  }
});

module.exports = router;
