import { generateKeyPairSync } from 'node:crypto';

function base64UrlFromBuffer(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});

const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });
const publicKeyBytes = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(publicJwk.x, 'base64url'),
  Buffer.from(publicJwk.y, 'base64url'),
]);

console.log('VAPID_PUBLIC_KEY=' + base64UrlFromBuffer(publicKeyBytes));
console.log('VAPID_PRIVATE_KEY=' + privateJwk.d);
console.log('Store the private key as a Cloudflare Worker secret. Do not commit it.');
