const express     = require('express');
const router      = express.Router();
const db          = require('../db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// GET /api/clients — return all clients with their nested jobs
router.get('/', async (req, res) => {
  try {
    const { rows: clients } = await db.query(
      'SELECT id, name, company, phone, email, address, notes, created_at, updated_at FROM clients WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    const { rows: jobs } = await db.query(
      'SELECT id, client_id, name, address, job_number, quotes, created_at, updated_at FROM jobs WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    const jobsByClient = {};
    jobs.forEach(j => {
      if (!jobsByClient[j.client_id]) jobsByClient[j.client_id] = [];
      jobsByClient[j.client_id].push({
        id:         j.id,
        client_id:  j.client_id,
        name:       j.name,
        address:    j.address,
        jobNumber:  j.job_number,
        quotes:     (typeof j.quotes === 'string' ? JSON.parse(j.quotes || '[]') : j.quotes) || [],
      });
    });
    res.json(clients.map(c => ({ ...c, jobs: jobsByClient[c.id] || [] })));
  } catch (err) {
    console.error('GET /api/clients:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/clients/sync — atomic full-replace of all clients+jobs for this user
router.post('/sync', async (req, res) => {
  const clients = req.body;
  if (!Array.isArray(clients)) return res.status(400).json({ error: 'Expected array' });
  // Refuse to wipe existing data with an empty payload — require explicit confirmation header
  if (clients.length === 0) {
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM clients WHERE user_id = $1', [req.user.userId]);
    if (rows[0].n > 0) {
      return res.status(400).json({ error: 'Refusing to delete all clients with empty payload. Send header X-Confirm-Wipe: true to override.' });
    }
  }
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM jobs    WHERE user_id = $1', [req.user.userId]);
    await db.query('DELETE FROM clients WHERE user_id = $1', [req.user.userId]);
    for (const c of clients) {
      const cid = String(c.id || Date.now());
      await db.query(
        `INSERT INTO clients (id, user_id, name, company, phone, email, address, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
        [cid, req.user.userId, c.name||'', c.company||'', c.phone||'', c.email||'', c.address||'', c.notes||'']
      );
      for (const j of (c.jobs || [])) {
        const jid = String(j.id || (Date.now() + Math.random()));
        await db.query(
          `INSERT INTO jobs (id, client_id, user_id, name, address, job_number, quotes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
          [jid, cid, req.user.userId, j.name||'', j.address||'', j.jobNumber||j.job_number||'', JSON.stringify(j.quotes||[])]
        );
      }
    }
    await db.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('POST /api/clients/sync:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/clients/:id — upsert a single client
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, company, phone, email, address, notes } = req.body;
  try {
    await db.query(
      `INSERT INTO clients (id, user_id, name, company, phone, email, address, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
       ON CONFLICT (id, user_id) DO UPDATE SET
         name=EXCLUDED.name, company=EXCLUDED.company, phone=EXCLUDED.phone,
         email=EXCLUDED.email, address=EXCLUDED.address, notes=EXCLUDED.notes, updated_at=NOW()`,
      [id, req.user.userId, name||'', company||'', phone||'', email||'', address||'', notes||'']
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/clients/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/clients/:id — delete a client and all its jobs
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM jobs    WHERE client_id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    await db.query('DELETE FROM clients WHERE id=$1       AND user_id=$2', [req.params.id, req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/clients/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/clients/:cid/jobs/:jid — upsert a single job
router.put('/:cid/jobs/:jid', async (req, res) => {
  const { cid, jid } = req.params;
  const { name, address, jobNumber, job_number, quotes } = req.body;
  try {
    await db.query(
      `INSERT INTO jobs (id, client_id, user_id, name, address, job_number, quotes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       ON CONFLICT (id, user_id) DO UPDATE SET
         client_id=EXCLUDED.client_id, name=EXCLUDED.name, address=EXCLUDED.address,
         job_number=EXCLUDED.job_number, quotes=EXCLUDED.quotes, updated_at=NOW()`,
      [jid, cid, req.user.userId, name||'', address||'', jobNumber||job_number||'', JSON.stringify(quotes||[])]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/clients/:cid/jobs/:jid:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/clients/:cid/jobs/:jid — delete a single job
router.delete('/:cid/jobs/:jid', async (req, res) => {
  try {
    await db.query('DELETE FROM jobs WHERE id=$1 AND client_id=$2 AND user_id=$3',
      [req.params.jid, req.params.cid, req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/clients/:cid/jobs/:jid:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
