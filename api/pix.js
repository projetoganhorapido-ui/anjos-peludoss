// api/pix.js — SigiloPay PIX (Vercel)

const CLIENT_ID     = "projeto-ganhorapido_fdcs1fextlajr7jr";
const CLIENT_SECRET = "72q9dox0b5vvg6vsinlavdo64ar0uyf582b0yixknfdb4n4cpupjcxkvmh7wmc8h";
const BASE_URL      = "https://app.sigilopay.com.br/api/v1";

// Autenticação Basic Base64
const BASIC_AUTH = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

const HEADERS = {
  "Authorization": `Basic ${BASIC_AUTH}`,
  "Content-Type":  "application/json",
  "Accept":        "application/json",
};

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET /api/pix?id=xxx  →  consulta status ──────────────────────────────
  if (req.method === "GET") {
    const id = req.query && req.query.id;
    if (!id) return res.status(400).json({ error: "Informe ?id=..." });

    try {
      const r    = await fetch(`${BASE_URL}/charges/${id}`, { headers: HEADERS });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(200).json({ id, status: data.status || null, raw: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/pix  →  gera cobrança PIX ──────────────────────────────────
  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const amount = body && body.amount;
    if (!amount) return res.status(400).json({ error: "Informe o valor (amount)" });

    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Testa os dois formatos de payload mais comuns da SigiloPay
    const payload = {
      amount:        amountInCents,
      paymentMethod: "PIX",
      customer: {
        name:     "Doador Anônimo",
        taxId:    "47742663087",
        email:    "doador@recantoanjos.com",
      },
      description: "Doação Recanto Anjos Peludos",
      externalId:  `anjos-${Date.now()}`,
    };

    try {
      const r    = await fetch(`${BASE_URL}/charges`, {
        method:  "POST",
        headers: HEADERS,
        body:    JSON.stringify(payload),
      });

      const text = await r.text();
      console.log("SigiloPay status:", r.status);
      console.log("SigiloPay response:", text.slice(0, 500));

      let data;
      try { data = JSON.parse(text); } catch {
        return res.status(500).json({
          error: "SigiloPay retornou resposta inválida",
          httpStatus: r.status,
          raw: text.slice(0, 300),
        });
      }

      if (!r.ok) {
        return res.status(r.status).json({
          error:  data.message || data.error || "Erro na SigiloPay",
          detail: data,
        });
      }

      // Normaliza campos — cobre todas as variações possíveis
      const copyPaste =
        data?.pix?.brCode        ||
        data?.pix?.copyPaste     ||
        data?.pix?.emv           ||
        data?.pix?.qrcode        ||
        data?.pixCopyPaste       ||
        data?.copyPaste          ||
        data?.brCode             ||
        data?.emv                ||
        data?.qrcode             ||
        data?.code               ||
        null;

      const qrCode =
        data?.pix?.qrCode        ||
        data?.pix?.base64        ||
        data?.pixQrCode          ||
        data?.qrCode             ||
        data?.qr_code            ||
        null;

      return res.status(200).json({
        id:         data.id,
        status:     data.status,
        copyPaste,
        qrCode,
        raw:        data,
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
};
