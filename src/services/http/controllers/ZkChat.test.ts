import tape from 'tape';

import { newRequest, newResponse, stubCall } from '@util/testUtils';
import { ZkChatController } from './ZkChat';

let controller: ZkChatController;
/* eslint-disable @typescript-eslint/no-unused-vars */
let call: ReturnType<typeof stubCall>[0];
let stubs: ReturnType<typeof stubCall>[1];
let req: ReturnType<typeof newRequest>;
let res: ReturnType<typeof newResponse>;

const init = (...params: Parameters<typeof newRequest>) => {
  controller = new ZkChatController();
  const stubCallRes = stubCall(controller);
  call = stubCallRes[0];
  stubs = stubCallRes[1];
  req = newRequest(...params);
  res = newResponse();
};

tape.skip('ZkChatController', t => {
  t.test('GET /v1/zkchat/users', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });

  t.test('POST /v1/zkchat/chat-message', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });

  t.test('GET /v1/zkchat/chat-messages/dm/:sender/:receiver', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });
  t.test('GET /v1/zkchat/chats/dm/:pubkey', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });
  t.test('GET /v1/zkchat/chats/search/:query?', async t => {
    init();
    t.equal('TODO', 'TODO', 'TODO');
  });
});
