const express    = require('express');
const router     = express.Router();
const requireAuth = require('../middleware/requireAuth');
const Anthropic  = require('@anthropic-ai/sdk');

// POST /api/ai/summarise-notes
router.post('/summarise-notes', requireAuth, async (req, res) => {
  const { clientName, jobName, siteAddr, zones, items, total, existingNotes } = req.body || {};

  try {
    const client = new Anthropic();

    // Build the user message
    const zoneStr  = Array.isArray(zones) && zones.length ? zones.join(', ') : 'general electrical work';
    const itemsStr = Array.isArray(items) && items.length
      ? items.map(i => `${i.name}${i.qty > 1 ? ' ×' + i.qty : ''}`).join(', ')
      : 'various electrical items';

    let userMsg = `Write quote notes for ${clientName || 'the client'}`;
    if (siteAddr) userMsg += ` at ${siteAddr}`;
    if (jobName)  userMsg += ` for ${jobName}`;
    userMsg += `.`;
    userMsg += ` The work covers: ${zoneStr}.`;
    userMsg += ` Key items include: ${itemsStr}.`;
    if (existingNotes && existingNotes.trim()) {
      userMsg += ` Additional context: ${existingNotes.trim()}`;
    }

    const message = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 300,
      system:     'You are a professional Australian electrician writing a brief, friendly quote note for a client. Keep it to 2-3 sentences, use plain English, no bullet points, no fluff. Don\'t mention specific prices.',
      messages:   [{ role: 'user', content: userMsg }],
    });

    const text = (message.content[0]?.text || '').trim();
    res.json({ notes: text });
  } catch (err) {
    console.error('[AI] summarise-notes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
