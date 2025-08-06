import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
  const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
  const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
  const AUTH0_AUDIENCE = `https://${AUTH0_DOMAIN}/api/v2/`;

  try {
    // Obtener token del Management API
    const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: AUTH0_CLIENT_ID,
        client_secret: AUTH0_CLIENT_SECRET,
        audience: AUTH0_AUDIENCE,
        grant_type: 'client_credentials',
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No se pudo obtener el token de Auth0');
      return res.status(500).json({ error: 'Error autenticando con Auth0' });
    }

    // Buscar usuario por email
    const userRes = await fetch(
      `https://${AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const users = await userRes.json();

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userId = users[0].user_id;

    // Reenviar email de verificación
    const resendRes = await fetch(
      `https://${AUTH0_DOMAIN}/api/v2/jobs/verification-email`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );

    if (!resendRes.ok) {
      console.error('Error al reenviar email', await resendRes.text());
      return res.status(500).json({ error: 'No se pudo reenviar el correo' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error inesperado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
