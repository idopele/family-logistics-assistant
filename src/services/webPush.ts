import type { PushSubscriptionRecord } from '../models';
import { base64UrlToUint8Array, uint8ArrayToBase64Url } from '../utils/base64Url';
import type { PushNotificationPayload } from './notificationScheduling';

export interface WebPushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

export interface WebPushSendResult {
  ok: boolean;
  status: number;
  permanentFailure: boolean;
  error?: string;
}

const textEncoder = new TextEncoder();

export async function sendWebPushNotification(
  subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>,
  payload: PushNotificationPayload,
  config: WebPushConfig,
  fetcher: typeof fetch = fetch,
): Promise<WebPushSendResult> {
  try {
    const endpointOrigin = new URL(subscription.endpoint).origin;
    const jwt = await createVapidJwt(endpointOrigin, config);
    const encryptedPayload = await encryptPushPayload(JSON.stringify(payload), subscription);
    const response = await fetcher(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${config.vapidPublicKey}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '2419200',
        Urgency: 'normal',
      },
      body: encryptedPayload,
    });

    return {
      ok: response.ok,
      status: response.status,
      permanentFailure: response.status === 404 || response.status === 410,
      error: response.ok ? undefined : `Push service returned ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      permanentFailure: false,
      error: error instanceof Error ? error.message : 'Unknown Web Push error',
    };
  }
}

export async function createVapidJwt(audience: string, config: WebPushConfig, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const publicKeyBytes = base64UrlToUint8Array(config.vapidPublicKey);

  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
    throw new Error('VAPID public key must be an uncompressed P-256 key.');
  }

  const signingKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33)),
      y: uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65)),
      d: config.vapidPrivateKey,
      ext: false,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const header = uint8ArrayToBase64Url(textEncoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = uint8ArrayToBase64Url(
    textEncoder.encode(
      JSON.stringify({
        aud: audience,
        exp: nowSeconds + 12 * 60 * 60,
        sub: config.vapidSubject,
      }),
    ),
  );
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, textEncoder.encode(`${header}.${body}`));

  return `${header}.${body}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
}

export async function encryptPushPayload(
  payload: string,
  subscription: Pick<PushSubscriptionRecord, 'p256dh' | 'auth'>,
): Promise<Uint8Array> {
  const receiverPublicKeyBytes = base64UrlToUint8Array(subscription.p256dh);
  const authSecret = base64UrlToUint8Array(subscription.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));
  const receiverPublicKey = await crypto.subtle.importKey('raw', receiverPublicKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPublicKey }, serverKeyPair.privateKey, 256),
  );
  const pseudoRandomKey = await hmacSha256(authSecret, sharedSecret);
  const info = concatUint8Arrays(
    textEncoder.encode('WebPush: info'),
    new Uint8Array([0]),
    receiverPublicKeyBytes,
    serverPublicKeyBytes,
  );
  const inputKeyMaterial = await hmacSha256(pseudoRandomKey, info);
  const contentEncryptionKey = await hkdfExpand(inputKeyMaterial, salt, 'Content-Encoding: aes128gcm', 16);
  const nonce = await hkdfExpand(inputKeyMaterial, salt, 'Content-Encoding: nonce', 12);
  const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, 'AES-GCM', false, ['encrypt']);
  const plaintext = concatUint8Arrays(textEncoder.encode(payload), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext));

  return concatUint8Arrays(
    salt,
    uint32ToBytes(4096),
    new Uint8Array([serverPublicKeyBytes.length]),
    serverPublicKeyBytes,
    ciphertext,
  );
}

async function hkdfExpand(secret: Uint8Array, salt: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const pseudoRandomKey = await hmacSha256(salt, secret);
  const output = await hmacSha256(pseudoRandomKey, concatUint8Arrays(textEncoder.encode(info), new Uint8Array([0, 1])));

  return output.slice(0, length);
}

async function hmacSha256(keyBytes: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  return new Uint8Array(await crypto.subtle.sign('HMAC', key, value));
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(arrays.reduce((totalLength, array) => totalLength + array.length, 0));
  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

function uint32ToBytes(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
}
