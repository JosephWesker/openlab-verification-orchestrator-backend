import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors"

dotenv.config();
const app = express();
app.use(
  cors({
    origin: 'https://verify.openlab.mx', // Dominio del frontend que hará la solicitud
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // solo si necesitas enviar cookies o auth headers
  })
)
app.use(express.json());

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;
const AUTH0_AUDIENCE = `https://${AUTH0_DOMAIN}/api/v2/`;

const getManagementToken = async () => {
  const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: AUTH0_AUDIENCE,
      grant_type: "client_credentials",
    }),
  });
  const data = await res.json();
  console.log("Respuesta de Auth0 al pedir token:", data);
  return data.access_token;
};

app.post("/api/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  try {
    const token = await getManagementToken();
    console.log("Token:", token);
    // Buscar usuario
    const userRes = await fetch(
      `https://${AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(
        email
      )}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const rawText = await userRes.text();
    console.log("Respuesta cruda:", rawText);

    let users;
    try {
      users = JSON.parse(rawText);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Error interpretando respuesta de Auth0" });
    }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userId = users[0].user_id;

    // Enviar correo de verificación
    await fetch(`https://${AUTH0_DOMAIN}/api/v2/jobs/verification-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error reenviando email" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
