/*
  Proyecto backend para Vercel (API Serverless)
  Endpoint: /api/resend-verification
*/

// File: api/resend-verification.js

export default async function handler(req, res) {
  // Permitir CORS desde el frontend
  res.setHeader('Access-Control-Allow-Origin', 'https://verify.openlab.mx');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejo de preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  try {
    // Aquí debes insertar la lógica para reenviar verificación vía Auth0 Management API
    console.log(`Solicitando reenvío de verificación para: ${email}`);

    // Simulación de éxito
    return res.status(200).json({ message: 'Correo de verificación reenviado exitosamente.' });
  } catch (error) {
    console.error('Error al reenviar verificación:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
