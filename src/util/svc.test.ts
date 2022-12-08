// @ts-ignore
import tape from 'tape';

import { GenericService, MainService } from './svc';

class SampleService extends GenericService {
  return = (value: any) => value;

  async start() {}
}

tape('svc.ts', async t => {
  const main = new MainService();
  main.add('sample', new SampleService());
  await main.start();

  t.equal(await main.call('sample', 'return', 23), 23, 'should invoke service calls');

  t.end();
});
