const port = 9338;
const CONC = 4;
const urls = JSON.parse((await import("node:fs")).default.readFileSync(process.argv[2], "utf8"));
const entries = Object.entries(urls);
const out = {};
async function render([code, u]) {
  try {
    const t = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then(r => r.json());
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    let id = 0; const pending = new Map(); let photo = null;
    const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    ws.onmessage = e => { const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
      if (m.method === "Network.requestWillBeSent" && /\/photos\/[A-Za-z0-9]+\//.test(m.params.request.url)) photo = m.params.request.url;
    };
    await new Promise(r => ws.onopen = r);
    await send("Network.enable"); await send("Page.navigate", { url: u });
    await new Promise(r => setTimeout(r, 5500));
    const tid = t.id || t.targetId;
    ws.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${tid}`).catch(()=>{});
    if (photo) out[code] = photo;
    process.stderr.write(photo ? "." : "x");
  } catch (e) { process.stderr.write("E"); }
}

let i = 0;
async function worker() { while (i < entries.length) { const e = entries[i++]; await render(e); } }
await Promise.all(Array.from({ length: CONC }, worker));
(await import("node:fs")).default.writeFileSync(process.argv[3], JSON.stringify(out));
console.error(`\ndone: ${Object.keys(out).length}/${entries.length}`);
process.exit(0);
