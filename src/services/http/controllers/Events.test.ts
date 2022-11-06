import tape from 'tape';

import { EventsController } from './Events';
import { newRequest, newResponse, stubCall } from '../../../util/testUtils';

let controller: EventsController;
let call: ReturnType<typeof stubCall>[0];
let stubs: ReturnType<typeof stubCall>[1];
let req: ReturnType<typeof newRequest>;
let res: ReturnType<typeof newResponse>;

const init = (...params: Parameters<typeof newRequest>) => {
  controller = new EventsController();
  const stubCallRes = stubCall(controller);
  call = stubCallRes[0];
  stubs = stubCallRes[1];
  req = newRequest(...params);
  res = newResponse();
};

tape.skip('EventsController', t => {
  t.test('GET /v1/events', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });

  t.test('POST /v1/events/:clientID', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });

  t.test('GET /v1/events/:clientId/alive', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });

  t.test('GET /v1/events/:clientID/terminate', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });
});
