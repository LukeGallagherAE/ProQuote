const express    = require('express');
const router     = express.Router();
const requireAuth = require('../middleware/requireAuth');
const Anthropic  = require('@anthropic-ai/sdk');

// POST /api/ai/summarise-notes
router.post('/summarise-notes', requireAuth, async (req, res) => {
  const { clientName, jobName, siteAddr, zones, items, total, existingNotes } = req.body || {};

  try {
    const client = new Anthropic();

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
      model:      'claude-haiku-4-5',
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

// POST /api/ai/suggest-section-items
router.post('/suggest-section-items', requireAuth, async (req, res) => {
  const { sectionName } = req.body || {};
  if (!sectionName) return res.status(400).json({ error: 'sectionName required' });

  try {
    const client = new Anthropic();

    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 800,
      system:     'You are an experienced Australian electrician\'s quoting assistant. Return ONLY valid JSON arrays — no markdown, no explanation, no code fences.',
      messages:   [{
        role:    'user',
        content: `The electrician is quoting electrical work for a section called: "${sectionName}"\n\nSuggest typical electrical items for this area.\n\nReturn ONLY a JSON array of objects: {"name":"Item name","qty":1,"note":"brief reason"}\n\nReturn 3–8 items.`,
      }],
    });

    const text = (message.content[0]?.text || '').trim();
    const suggestions = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json({ suggestions });
  } catch (err) {
    console.error('[AI] suggest-section-items error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/suggest-subitems
router.post('/suggest-subitems', requireAuth, async (req, res) => {
  const { itemName, relevantItems } = req.body || {};
  if (!itemName) return res.status(400).json({ error: 'itemName required' });

  try {
    const client = new Anthropic();

    const relevantStr = relevantItems && relevantItems.length
      ? relevantItems.join('\n')
      : 'No exact matches.';

    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 1000,
      system:     'You are an experienced Australian electrician\'s quoting assistant. Return ONLY valid JSON arrays — no markdown, no explanation, no code fences.',
      messages:   [{
        role:    'user',
        content: `The electrician is quoting an item called: "${itemName}"\n\nRelevant pricelist items:\n${relevantStr}\n\nSuggest the typical sub-items needed. Each element:\n{"name":"short description","cat":"supply"|"wire"|"install","code":"pricelist code or null","qty":1,"wireMin":0,"instMin":0,"markup":100,"note":"brief reason"}\n\nSupply=materials, Wire=running/connecting cable (labour), Install=fitting/fixing (labour).\nReturn 3–8 items. Return ONLY the JSON array.`,
      }],
    });

    const text = (message.content[0]?.text || '').trim();
    const suggestions = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json({ suggestions });
  } catch (err) {
    console.error('[AI] suggest-subitems error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
