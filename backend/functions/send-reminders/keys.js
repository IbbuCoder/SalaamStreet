// SalaamStreet — Web Push (VAPID) keys made on the server, so the private
// key never passes through anyone's hands. Plain JavaScript so the tests can
// check it. Formats are what the web-push library and browsers expect:
// public = base64url of the 65-byte uncompressed P-256 point, private =
// base64url of the 32-byte private scalar.

function b64u(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function generateVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const d = unb64u(jwk.d);
  if (raw.length !== 65 || raw[0] !== 4 || d.length !== 32) throw new Error("unexpected key format");
  return { publicKey: b64u(raw), privateKey: jwk.d };
}

export { b64u, unb64u };
