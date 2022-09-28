import EC from 'elliptic';

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = Buffer.from(
        base64.replace(/_/g, '/').replace(/-/g, '+'),
        'base64'
    ).toString('binary');
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

export function verifySignatureP256(pubkey: string, data: string, signature: string): boolean {
    const [x, y] = pubkey.split('.');
    const ec = new EC.ec('p256');
    const pub = ec.keyFromPublic({
        x: Buffer.from(base64ToArrayBuffer(x)).toString('hex'),
        y: Buffer.from(base64ToArrayBuffer(y)).toString('hex'),
    });
    return pub.verify(
        Buffer.from(data, 'utf-8').toString('hex'),
        Buffer.from(signature, 'hex').toJSON().data
    );
}
