export default async function handler(req, res) {
  let target = req.query.url;
  if (!target) return res.status(400).send("url fehlt");
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;
  let u;
  try { u = new URL(target); } catch { return res.status(400).send("Ungueltige URL"); }

  try {
    const r = await fetch(u.href, {
      redirect: "follow",
      headers: {
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
        "accept": req.headers["accept"] || "*/*",
        "accept-language": req.headers["accept-language"] || "de,en;q=0.8",
      },
    });
    const type = r.headers.get("content-type") || "";
    const base = r.url;
    const prox = (link) => {
      try { return "/api/proxy?url=" + encodeURIComponent(new URL(link, base).href); }
      catch { return link; }
    };

    res.status(r.status);
    res.setHeader("content-type", type);

    if (type.includes("text/html")) {
      let html = await r.text();
      html = html.replace(/<meta[^>]+http-equiv=["']content-security-policy["'][^>]*>/gi, "");
      html = html.replace(/\s(href|src|action|poster)=(["'])(.*?)\2/gi, (m, a, q, v) => {
        if (/^(#|data:|javascript:|mailto:|tel:)/i.test(v)) return m;
        return ` ${a}=${q}${prox(v)}${q}`;
      });
      html = html.replace(/url\((["']?)(.*?)\1\)/gi, (m, q, v) =>
        /^(data:|#)/i.test(v) ? m : `url(${q}${prox(v)}${q})`);
      return res.send(html);
    }

    if (type.includes("text/css")) {
      let css = await r.text();
      css = css.replace(/url\((["']?)(.*?)\1\)/gi, (m, q, v) =>
        /^(data:|#)/i.test(v) ? m : `url(${q}${prox(v)}${q})`);
      return res.send(css);
    }

    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(502).send("Fehler: " + e.message);
  }
}
