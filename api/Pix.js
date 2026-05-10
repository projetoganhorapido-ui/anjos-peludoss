// api/pix.js — SigiloPay PIX (Vercel)

const CLIENT_ID     = "projeto-ganhorapido_fdcs1fextlajr7jr";
const CLIENT_SECRET = "72q9dox0b5vvg6vsinlavdo64ar0uyf582b0yixknfdb4n4cpupjcxkvmh7wmc8h";
const BASE_URL      = "https://app.sigilopay.com.br/api/v1";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET /api/pix?id=xxx  →  consulta status ───────────────────────────────
  if (req.method === "GET") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Informe ?id=..." });

    try {
      const r    = await fetch(`${BASE_URL}/charges/${id}`, {
        headers: {
          "x-public-key":  CLIENT_ID,
          "x-secret-key":  CLIENT_SECRET,
          "Content-Type":  "application/json",
        },
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return res.status(r.status).json({ id, status: data.status ?? null, raw: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/pix  →  gera cobrança ──────────────────────────────────────
  if (req.method === "POST") {
    const { amount } = req.body || {};
    if (!amount) return res.status(400).json({ error: "Informe o valor (amount)" });

    const amountInCents = Math.round(parseFloat(amount) * 100);

    // SigiloPay: customer com dados mínimos aceitáveis
    const payload = {
      amount:        amountInCents,
      paymentMethod: "PIX",
      customer: {
        name:  "Doador Anônimo",
        taxId: "47742663087",          // CPF válido de teste
        email: "doador@recantoanjos.com",
      },
      description: "Doação Recanto Anjos Peludos",
      externalId:  `anjos-${Date.now()}`,
    };

    try {
      const r    = await fetch(`${BASE_URL}/charges`, {
        method:  "POST",
        headers: {
          "x-public-key":  CLIENT_ID,
          "x-secret-key":  CLIENT_SECRET,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }

      // Se a API retornou erro, devolve o corpo bruto para debug
      if (!r.ok) {
        return res.status(r.status).json({
          error:  data?.message || data?.error || "Erro na SigiloPay",
          detail: data,
          raw:    text,
        });
      }

      // Normaliza campos PIX — SigiloPay pode variar
      const copyPaste =
        data?.pix?.brCode        ||
        data?.pix?.copyPaste     ||
        data?.pix?.copy_paste    ||
        data?.pixCopyPaste       ||
        data?.pix_copy_paste     ||
        data?.copyPaste          ||
        data?.copy_paste         ||
        data?.brCode             ||
        null;

      const qrCode =
        data?.pix?.qrCode        ||
        data?.pix?.qr_code       ||
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
        raw:        data,          // mantém para debug; remova depois
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
