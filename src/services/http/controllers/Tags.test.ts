import tape from 'tape';

import { post } from '@services/http/_fixtures';
import { newRequest, newResponse, stubCall } from '@util/testUtils';
import { TagsController } from './Tags';

let controller: TagsController;
/* eslint-disable @typescript-eslint/no-unused-vars */
let call: ReturnType<typeof stubCall>[0];
let stubs: ReturnType<typeof stubCall>[1];
let req: ReturnType<typeof newRequest>;
let res: ReturnType<typeof newResponse>;

const init = (...params: Parameters<typeof newRequest>) => {
  controller = new TagsController();
  const stubCallRes = stubCall(controller);
  call = stubCallRes[0];
  stubs = stubCallRes[1];
  req = newRequest(...params);
  res = newResponse();
};

tape('TagsController', t => {
  t.test('GET /v1/tags', async t => {
    init();
    stubs.meta.findTags.returns(Promise.resolve([{ tagName: '#test' }]));

    await controller.getMany(req, res);

    t.deepEqual(stubs.meta.findTags.args[0], [0, 10], 'should find all tags');
    t.deepEqual(
      res.send.args[0],
      [{ error: undefined, payload: [{ tagName: '#test' }] }],
      'should return all tags'
    );
  });

  t.test('GET /v1/tags/:tagName', async t => {
    init({ tagName: '#unittest' });
    stubs.tags.getPostsByTag.returns(Promise.resolve([post]));

    await controller.getPostsByTagName(req, res);

    t.deepEqual(
      stubs.tags.getPostsByTag.args[0],
      ['#unittest', undefined, 0, 10],
      'should find all posts'
    );
    t.deepEqual(
      res.send.args[0],
      [{ error: undefined, payload: [post] }],
      'should return all posts'
    );
  });
});
