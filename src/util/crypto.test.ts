import 'isomorphic-fetch';
// @ts-ignore
import tape from 'tape';

import { verifySignatureP256 } from './crypto';

tape('crypto.ts', async t => {
  const signature =
    '304402205eef94ed090d04f273b756a206dcabe875dc22e3be863d9d45065c2e405b3bdc022042f676412c5f0579c256f2ee7744950e3a661695e270c7bbaddbff9be2ac8357.0xf622d6eC8a21532a62BA2CAFdda571c24D670E5c';
  const [sig, address] = signature.split('.');

  const verified = verifySignatureP256(
    'cl-5YNh_qXWMxfn5rBiHgkJhNE8t4C6ESW6miFfo6Hw.sditz_GeLXkkfKblos8X6hZlH3HWCHUnvJTwhCItYp4',
    '0xf622d6eC8a21532a62BA2CAFdda571c24D670E5c',
    sig
  );
  t.ok(verified, 'should verified signature');
  t.end();
});
