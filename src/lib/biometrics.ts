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

export interface Passkey { id: string; publicKey: string; alg: number }

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

export async function fingerprintAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export async function registerFingerprint(user: { id: string; name: string; displayName: string }): Promise<Passkey> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Disbursia · Katsina State' },
      user: { id: new TextEncoder().encode(user.id), name: user.name, displayName: user.displayName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('Fingerprint registration was cancelled.');
  const res = cred.response as AuthenticatorAttestationResponse;
  const spki = res.getPublicKey?.();
  const alg = res.getPublicKeyAlgorithm?.();
  if (!spki || alg === undefined) throw new Error('This browser cannot export the fingerprint key. Update your browser and try again.');
  return { id: b64u(cred.rawId), publicKey: b64u(spki), alg };
}

/** DER ECDSA signature -> raw r||s (64 bytes) for WebCrypto. */
function derToRaw(der: Uint8Array): Uint8Array {
  let i = 2;
  const read = () => {
    if (der[i] !== 0x02) throw new Error('bad signature');
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

export async function verifyFingerprint(passkey: Passkey): Promise<void> {
  const challenge = randomChallenge();
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: fromB64u(passkey.id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('Fingerprint check was cancelled.');
  const res = cred.response as AuthenticatorAssertionResponse;
  const clientData = JSON.parse(new TextDecoder().decode(res.clientDataJSON));
  if (clientData.type !== 'webauthn.get' || clientData.challenge !== b64u(challenge) || clientData.origin !== location.origin) {
    throw new Error('Fingerprint response did not match this sign-in.');
  }
  const authData = new Uint8Array(res.authenticatorData);
  if (!(authData[32] & 0x04)) throw new Error('The device did not confirm your fingerprint.');
  const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', res.clientDataJSON));
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
}

export function biometricError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'The request was cancelled or timed out. Try again.';
    if (e.name === 'NotFoundError') return 'No camera or fingerprint sensor was found on this device.';
    if (e.name === 'NotReadableError') return 'The camera is in use by another app.';
    if (e.name === 'SecurityError') return 'Biometrics need a secure (HTTPS) connection.';
    if (e.name === 'InvalidStateError') return 'This fingerprint is already registered on this device.';
  }
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}
