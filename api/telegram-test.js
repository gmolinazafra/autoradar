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
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ ok: false, error: 'Telegram environment variables missing' });

  try {
    const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🚐 AutoRadar conectado correctamente. Este es un mensaje de prueba; el rastreo automático de anuncios aún no está activado.'
      }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return res.status(502).json({ ok: false, error: 'Telegram rejected the message', telegram_code: data.error_code, description: data.description });
    return res.status(200).json({ ok: true, message_id: data.result?.message_id });
  } catch {
    return res.status(502).json({ ok: false, error: 'Telegram request failed' });
  }
}
