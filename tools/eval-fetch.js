(async () => {
  const id = 'p-mw539d1s2b7085';
  const url = '/api/pdf/' + id;
  const out = {};
  try {
    const r = await fetch(url);
    out.plain = { status: r.status, len: r.headers.get('content-length'), type: r.headers.get('content-type'), ranges: r.headers.get('accept-ranges') };
    const buf = await r.arrayBuffer();
    out.plain.bytes = buf.byteLength;
  } catch (e) { out.plainErr = String(e); }
  try {
    const r2 = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
    out.range = { status: r2.status, len: r2.headers.get('content-length'), cr: r2.headers.get('content-range') };
    const b2 = await r2.arrayBuffer();
    out.range.bytes = b2.byteLength;
  } catch (e) { out.rangeErr = String(e); }
  try {
    const r3 = await fetch(url, { method: 'HEAD' });
    out.head = { status: r3.status, len: r3.headers.get('content-length') };
  } catch (e) { out.headErr = String(e); }
  out.hasLB = !!window.LB;
  out.hasPdfjs = !!window.pdfjsLib;
  out.hash = location.hash;
  return out;
})()
