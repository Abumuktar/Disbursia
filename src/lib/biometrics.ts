/**
 * Device biometrics for the administrator sign-in.
 *
 * Face: @vladmandic/face-api (TensorFlow.js) runs fully in the browser. A 128-number face descriptor
 * is enrolled once and compared on each sign-in (Euclidean distance).
 *
 * Fingerprint: WebAuthn with the laptop's platform authenticator (Windows Hello, Touch ID, Android
 * biometrics) and user verification required. The public key is stored at enrollment and every
 * sign-in assertion signature is verified with WebCrypto.
 *
 * In production the face template, public key and challenges belong on the server.
 */

type FaceApi = typeof import('@vladmandic/face-api');
let api: Promise<FaceApi> | null = null;

export function loadFaceModels(): Promise<FaceApi> {
  if (!api) {
    api = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      await (faceapi.tf as unknown as { ready: () => Promise<void> }).ready();
      const url = `${import.meta.env.BASE_URL}models`;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
      ]);
      return faceapi;
    })();
    api.catch(() => { api = null; });
  }
  return api;
}

export interface FaceReading { descriptor: Float32Array; score: number; box: { x: number; y: number; width: number; height: number } }

export async function readFace(video: HTMLVideoElement): Promise<FaceReading | null> {
  const faceapi = await loadFaceModels();
  if (video.readyState < 2) return null;
  const r = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!r) return null;
  const b = r.detection.box;
  return { descriptor: r.descriptor, score: r.detection.score, box: { x: b.x, y: b.y, width: b.width, height: b.height } };
}

export const FACE_MATCH_THRESHOLD = 0.5;

export function faceDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

export function averageDescriptor(samples: Float32Array[]): number[] {
  const out = new Array(samples[0].length).fill(0);
  for (const s of samples) for (let i = 0; i < s.length; i++) out[i] += s[i] / samples.length;
  return out;
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot access a camera. Use Chrome, Edge or Safari over HTTPS.');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

// ---- WebAuthn (fingerprint) -------------------------------------------------

export interface Passkey { id: string; publicKey: string; alg: number; signCount?: number }

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64u = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const randomChallenge = () => crypto.getRandomValues(new Uint8Array(32));
const sha256Bytes = async (data: BufferSource) => new Uint8Array(await crypto.subtle.digest('SHA-256', data));
const equalBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

export interface FingerprintSupport { secure: boolean; api: boolean; platform: boolean }

export async function fingerprintSupport(): Promise<FingerprintSupport> {
  const secure = window.isSecureContext;
  const api = !!window.PublicKeyCredential && !!navigator.credentials;
  let platform = false;
  if (secure && api) {
    try { platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { platform = false; }
  }
  return { secure, api, platform };
}

export async function fingerprintAvailable(): Promise<boolean> {
  return (await fingerprintSupport()).platform;
}

function assertUsable() {
  if (!window.isSecureContext) throw new Error('The fingerprint sensor only works over a secure connection. Open Disbursia on https:// or localhost.');
  if (!window.PublicKeyCredential || !navigator.credentials) throw new Error('This browser does not support fingerprint sign-in. Use the latest Chrome, Edge or Safari.');
}

// Minimal CBOR decoder, enough for WebAuthn attestation objects and COSE keys.
function decodeCbor(bytes: Uint8Array): unknown {
  let pos = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readLen = (info: number): number => {
    if (info < 24) return info;
    if (info === 24) return bytes[pos++];
    if (info === 25) { const v = view.getUint16(pos); pos += 2; return v; }
    if (info === 26) { const v = view.getUint32(pos); pos += 4; return v; }
    if (info === 27) { const v = Number(view.getBigUint64(pos)); pos += 8; return v; }
    throw new Error('Unsupported CBOR length');
  };
  const item = (): unknown => {
    const ib = bytes[pos++];
    const major = ib >> 5, info = ib & 31;
    switch (major) {
      case 0: return readLen(info);
      case 1: return -1 - readLen(info);
      case 2: { const n = readLen(info); const v = bytes.slice(pos, pos + n); pos += n; return v; }
      case 3: { const n = readLen(info); const v = new TextDecoder().decode(bytes.slice(pos, pos + n)); pos += n; return v; }
      case 4: { const n = readLen(info); return Array.from({ length: n }, item); }
      case 5: { const n = readLen(info); const m = new Map<unknown, unknown>(); for (let i = 0; i < n; i++) { const k = item(); m.set(k, item()); } return m; }
      case 7: return info === 20 ? false : info === 21 ? true : null;
      default: throw new Error('Unsupported CBOR item');
    }
  };
  return item();
}

/** Extract the credential public key (SPKI) from the attestation object when getPublicKey() is unavailable. */
async function publicKeyFromAttestation(attestationObject: ArrayBuffer): Promise<{ spki: ArrayBuffer; alg: number }> {
  const att = decodeCbor(new Uint8Array(attestationObject)) as Map<string, unknown>;
  const authData = att.get('authData') as Uint8Array;
  if (!(authData[32] & 0x40)) throw new Error('The device did not return a fingerprint key.');
  const credLen = (authData[53] << 8) | authData[54];
  const cose = decodeCbor(authData.slice(55 + credLen)) as Map<number, unknown>;
  const alg = cose.get(3) as number;
  let jwk: JsonWebKey, params: EcKeyImportParams | RsaHashedImportParams;
  if (cose.get(1) === 2) {
    jwk = { kty: 'EC', crv: 'P-256', x: b64u(cose.get(-2) as Uint8Array), y: b64u(cose.get(-3) as Uint8Array), ext: true };
    params = { name: 'ECDSA', namedCurve: 'P-256' };
  } else if (cose.get(1) === 3) {
    jwk = { kty: 'RSA', n: b64u(cose.get(-1) as Uint8Array), e: b64u(cose.get(-2) as Uint8Array), alg: 'RS256', ext: true };
    params = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  } else throw new Error('Unsupported fingerprint key type.');
  const key = await crypto.subtle.importKey('jwk', jwk, params, true, ['verify']);
  return { spki: await crypto.subtle.exportKey('spki', key), alg };
}

export async function registerFingerprint(user: { id: string; name: string; displayName: string }, existing?: Passkey): Promise<Passkey> {
  assertUsable();
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Disbursia · Katsina State', id: location.hostname },
      user: { id: new TextEncoder().encode(user.id), name: user.name, displayName: user.displayName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      excludeCredentials: existing ? [{ type: 'public-key', id: fromB64u(existing.id) }] : [],
      timeout: 60000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('Fingerprint registration was cancelled.');
  const res = cred.response as AuthenticatorAttestationResponse;
  const clientData = JSON.parse(new TextDecoder().decode(res.clientDataJSON));
  if (clientData.type !== 'webauthn.create' || clientData.origin !== location.origin) throw new Error('Fingerprint registration did not come from this site.');
  let spki: ArrayBuffer | null = null;
  let alg: number | undefined;
  try { spki = res.getPublicKey?.() ?? null; alg = res.getPublicKeyAlgorithm?.(); } catch { spki = null; }
  if (!spki || alg === undefined) ({ spki, alg } = await publicKeyFromAttestation(res.attestationObject));
  return { id: b64u(cred.rawId), publicKey: b64u(spki), alg, signCount: 0 };
}

/** DER ECDSA signature -> raw r||s (64 bytes) for WebCrypto. */
function derToRaw(der: Uint8Array): Uint8Array {
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  const read = () => {
    if (der[i] !== 0x02) throw new Error('Malformed fingerprint signature.');
    const len = der[i + 1];
    let v = der.slice(i + 2, i + 2 + len);
    i += 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = read(), s = read();
  const raw = new Uint8Array(64);
  raw.set(r); raw.set(s, 32);
  return raw;
}

/** Prompts for the fingerprint and verifies the signed response. Returns the new signature counter. */
export async function verifyFingerprint(passkey: Passkey): Promise<{ signCount: number }> {
  assertUsable();
  const challenge = randomChallenge();
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromB64u(passkey.id), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('Fingerprint check was cancelled.');
  if (b64u(cred.rawId) !== passkey.id) throw new Error('A different fingerprint key answered. Use the laptop you enrolled.');
  const res = cred.response as AuthenticatorAssertionResponse;
  const clientData = JSON.parse(new TextDecoder().decode(res.clientDataJSON));
  if (clientData.type !== 'webauthn.get' || clientData.challenge !== b64u(challenge) || clientData.origin !== location.origin) {
    throw new Error('Fingerprint response did not match this sign-in.');
  }
  const authData = new Uint8Array(res.authenticatorData);
  if (!equalBytes(authData.slice(0, 32), await sha256Bytes(new TextEncoder().encode(location.hostname)))) throw new Error('Fingerprint response was issued for a different site.');
  if (!(authData[32] & 0x01)) throw new Error('The sensor did not register a touch.');
  if (!(authData[32] & 0x04)) throw new Error('The device did not confirm your fingerprint.');
  const signCount = new DataView(authData.buffer, authData.byteOffset).getUint32(33);
  if (passkey.signCount && signCount > 0 && signCount <= passkey.signCount) throw new Error('This fingerprint key may have been copied. Re-enroll your fingerprint.');
  const clientHash = await sha256Bytes(res.clientDataJSON);
  const signed = new Uint8Array(authData.length + clientHash.length);
  signed.set(authData); signed.set(clientHash, authData.length);
  const spki = fromB64u(passkey.publicKey);
  let ok = false;
  if (passkey.alg === -7) {
    const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(new Uint8Array(res.signature)), signed);
  } else if (passkey.alg === -257) {
    const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, new Uint8Array(res.signature), signed);
  }
  if (!ok) throw new Error('Fingerprint signature could not be verified.');
  return { signCount };
}

export function biometricError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'The fingerprint prompt was cancelled or timed out. Try again and touch the sensor when asked.';
    if (e.name === 'NotFoundError') return 'No camera or fingerprint sensor was found on this device.';
    if (e.name === 'NotReadableError') return 'The camera is in use by another app.';
    if (e.name === 'SecurityError') return 'Biometrics need a secure connection. Open Disbursia on https:// or localhost.';
    if (e.name === 'InvalidStateError') return 'This laptop already has a Disbursia fingerprint registered. Use Test fingerprint, or re-enroll from Settings.';
    if (e.name === 'NotSupportedError') return 'This device cannot create a fingerprint key. Check that Windows Hello or Touch ID is set up.';
    if (e.name === 'AbortError') return 'The fingerprint request was interrupted. Try again.';
  }
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}
