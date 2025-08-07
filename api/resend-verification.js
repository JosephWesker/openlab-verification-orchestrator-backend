import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// --- Configuración de Supabase ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader("Access-Control-Allow-Origin", "*"); // ToDo: only allow verify.openlab.mx
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400"); // caché del preflight

  // Responder a preflight CORS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { userEmail, clientId, returnTo } = req.body;

  if (!userEmail || !clientId || !returnTo) {
    return res.status(400).json({ error: "Falta algún parámetro" });
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

    // 2. Buscar usuario por email en Auth0
    const userSearchRes = await fetch(
      `https://${
        process.env.AUTH0_DOMAIN
      }/api/v2/users-by-email?email=${encodeURIComponent(userEmail)}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const users = await userSearchRes.json();
    if (!Array.isArray(users) || users.length === 0) {
      return res
        .status(404)
        .json({ error: "Usuario no encontrado con ese email" });
    }

    const userId = users[0].user_id;

    // --- Lógica de Cooldown con Supabase ---
    const COOLDOWN_SECONDS = 60; // Define el tiempo de espera en segundos
    const now = Date.now();

    // 3. Consulta la base de datos de Supabase para el último timestamp
    const { data: cooldownData, error: cooldownError } = await supabase
      .from("cooldowns")
      .select("last_sent_timestamp")
      .eq("user_id", userId)
      .single();

    if (cooldownError && cooldownError.code !== "PGRST116") {
      // 'PGRST116' es cuando no se encuentra el registro
      console.error("Error al consultar cooldown en Supabase:", cooldownError);
    }

    if (
      cooldownData &&
      now - cooldownData.last_sent_timestamp < COOLDOWN_SECONDS * 1000
    ) {
      // Si el último envío fue hace menos de 60 segundos
      return res
        .status(429)
        .json({ error: "Demasiados intentos. Intenta de nuevo más tarde." });
    }

    // 4. Llama a la API de Auth0 para reenviar el email de verificación
    const verifyResponse = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/jobs/verification-email`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          // client_id: process.env.AUTH0_CLIENT_ID,
          client_id: clientId,
          redirect_uri: returnTo
        }),
      }
    );

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      return res
        .status(400)
        .json({ error: "Error al reenviar el correo", detail: errorData });
    }

    // console.log("userId", userId);
    // console.log("clientId", clientId);
    // console.log("returnTo", returnTo);

    // const ticketResponse = await fetch(
    //   `https://${process.env.AUTH0_DOMAIN}/api/v2/tickets/email-verification`,
    //   {
    //     method: "POST",
    //     headers: {
    //       Authorization: `Bearer ${access_token}`,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       result_url: returnTo,
    //       user_id: userId,
    //       client_id: clientId
    //       // Pasa la URL de redirección en el ticket
    //       // Este es el parámetro que le dirá a Auth0 a dónde ir
    //     }),
    //   }
    // );

    // if (!ticketResponse.ok) {
    //   const errorData = await ticketResponse.json();
    //   return res.status(400).json({
    //     error: "Error al crear el ticket de verificación",
    //     detail: errorData,
    //   });
    // }

    // 5. Si el envío fue exitoso, actualiza o inserta el timestamp en Supabase
    const { error: upsertError } = await supabase
      .from("cooldowns")
      .upsert({ user_id: userId, last_sent_timestamp: now });

    if (upsertError) {
      console.error(
        "Error al actualizar el cooldown en Supabase:",
        upsertError
      );
    }

    res.status(200).json({ message: "Correo de verificación reenviado." });
    // const { ticket } = await ticketResponse.json();
    // res.status(200).json({
    //   message: "Correo de verificación reenviado.",
    //   ticketUrl: ticket,
    // });
  } catch (err) {
    console.error("Error reenviando verificación:", err);
    res.status(500).json({ error: "Error interno al reenviar verificación" });
  }
}
