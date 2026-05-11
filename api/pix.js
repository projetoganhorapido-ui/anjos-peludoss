// api/pix.js — SigiloPay PIX (Vercel)

const CLIENT_ID     = "projeto-ganhorapido_ad2mzxoky78guosc";
const CLIENT_SECRET = "ribhsfce0oi8bt881swb39pzxjw4tnqfeql82bgrxjzr22c6ii2v9yx70l2i7k6m";
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

  // GET /api/pix?id=xxx — consulta status
  if (req.method === "GET") {
    const id = req.query && req.query.id;
    if (!id) return res.status(400).json({ error: "Informe ?id=..." });

    try {
      const r    = await fetch(`${BASE_URL}/gateway/pix/receive/${id}`, { headers: HEADERS });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(200).json({ id, status: data.status || null, raw: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/pix — gera cobrança PIX
  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const amount = body && body.amount;
    if (!amount) return res.status(400).json({ error: "Informe o valor da doação" });

    const payload = {
      identifier: `anjos-${Date.now()}`,
      amount:     parseFloat(amount),
      client: {
        name:     "Doador Anônimo",
        email:    "doador@recantoanjos.com",
        phone:    "(11) 99999-9999",
        document: "47742663087",
      },
    };

    try {
      const r = await fetch(`${BASE_URL}/gateway/pix/receive`, {
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
          error:      "SigiloPay retornou resposta inválida",
          httpStatus: r.status,
          raw:        text.slice(0, 300),
        });
      }

      if (!r.ok) {
        return res.status(r.status).json({
          error:  data.message || data.error || "Erro na SigiloPay",
          detail: data,
        });
      }

      // Campos do retorno conforme documentação
      const copyPaste = data?.pix?.code || null;
      const qrCode    = data?.pix?.base64 || data?.pix?.image || null;

      return res.status(200).json({
        id:        data.transactionId,
        status:    data.status,
        copyPaste,
        qrCode,
        raw:       data,
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
};
