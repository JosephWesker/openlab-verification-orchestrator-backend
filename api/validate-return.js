import fetch from "node-fetch";

export default async function handler(req, res) {
  // Habilitar CORS para tu frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // const { returnTo, clientId } = req.body;
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ error: "Falta el clientId" });
  }

  try {
    // 1. Obtener token del Management API de Auth0
    const authResponse = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.AUTH0_CLIENT_ID,
          client_secret: process.env.AUTH0_CLIENT_SECRET,
          audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
          grant_type: "client_credentials",
        }),
      }
    );

    const { access_token } = await authResponse.json();

    if (!access_token) {
      return res
        .status(500)
        .json({ error: "No se pudo obtener el token de acceso" });
    }

    // 2. Obtener la aplicación para leer los Allowed Callback URLs
    const clientRes = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/clients/${clientId}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!clientRes.ok) {
      const errorData = await clientRes.json();
      return res
        .status(clientRes.status)
        .json({ error: "Error al obtener la aplicación", detail: errorData });
    }

    const clientData = await clientRes.json();
    console.log("clientData", clientData);
    const allowedCallbacks = clientData.callbacks || [];

    // 3. Validar que el returnTo esté exactamente en la lista
    if (allowedCallbacks.length > 0) {
      return res.status(200).json({ valid: true, safeUrl: allowedCallbacks[0] });
    } else {
      return res.status(400).json({
        valid: false,
        error: "URL no permitida en los callbacks de la aplicación",
      });
    }
    // if (allowedCallbacks.includes(returnTo)) {
    //   return res.status(200).json({ valid: true, safeUrl: returnTo });
    // } else {
    //   return res.status(400).json({
    //     valid: false,
    //     error: "URL no permitida en los callbacks de la aplicación",
    //   });
    // }
  } catch (err) {
    console.error("Error validando returnTo:", err);
    res.status(500).json({ error: "Error interno al validar returnTo" });
  }
}
