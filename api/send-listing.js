import { timingSafeEqual } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const secret = process.env.AUTORADAR_ADMIN_KEY;
  const supplied = req.headers['x-autoradar-admin-key'];
  if (!secret || typeof supplied !== 'string') return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { title, url, price } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.length > 160 || typeof url !== 'string' || url.length > 2000) return res.status(400).json({ ok: false, error: 'Invalid listing' });
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ ok: false, error: 'Invalid URL' }); }
  if (parsed.protocol !== 'https:' || !['wallapop.com','milanuncios.com'].some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain))) return res.status(400).json({ ok: false, error: 'Only Wallapop and Milanuncios HTTPS URLs are accepted' });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ ok: false, error: 'Telegram environment variables missing' });

  const safeTitle = title.trim().replace(/[<>]/g, '');
  const safePrice = typeof price === 'string' || typeof price === 'number' ? String(price).slice(0, 30).replace(/[<>]/g, '') : '';
  const text = '🚐 AutoRadar · Anuncio guardado\n' + safeTitle + (safePrice ? '\nPrecio: ' + safePrice + ' €' : '') + '\n' + parsed.href + '\n\nEnviado manualmente; el rastreo automático aún no está activado.';
  try {
    const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return res.status(502).json({ ok: false, error: 'Telegram rejected the message', telegram_code: data.error_code, description: data.description });
    return res.status(200).json({ ok: true, message_id: data.result?.message_id });
  } catch {
    return res.status(502).json({ ok: false, error: 'Telegram request failed' });
  }
}
