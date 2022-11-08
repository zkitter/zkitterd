import 'isomorphic-fetch';
import tape from 'tape';

import { MiscController } from './Misc';
import { newRequest, newResponse, stubCall } from '../../../util/testUtils';

let controller: MiscController;
let call: ReturnType<typeof stubCall>[0];
let stubs: ReturnType<typeof stubCall>[1];
let req: ReturnType<typeof newRequest>;
let res: ReturnType<typeof newResponse>;

const init = (...params: Parameters<typeof newRequest>) => {
  controller = new MiscController();
  const stubCallRes = stubCall(controller);
  call = stubCallRes[0];
  stubs = stubCallRes[1];
  req = newRequest(...params);
  res = newResponse();
};

// FIXME
tape.skip('MiscController', t => {
  t.test('GET /preview', async t => {
    init(null, null, { link: 'https://auti.sm' });

    await controller.preview(req, res);
    // const getStub = sinon.stub(http.app, 'get');
    // sinon.stub(http.app, 'post');
    //
    // http.addRoutes();
    //
    // const getPreviewParams = getStub.args[23];
    // // @ts-ignore
    // const getPreviewHandler: any = getPreviewParams[1];
    // const getPreviewRequest = newRequest(null, null, { link: 'https://auti.sm' });
    // await getPreviewHandler(getPreviewRequest, res);
    //
    // t.equal(getPreviewParams[0], '/preview', 'should listen to correct path');

    // response is currently: 'uri requested responds with a redirect, redirect mode is set to error: https://auti.sm/'
    t.deepEqual(
      res.send.args[0][0],
      {
        payload: {
          link: 'https://www.auti.sm/',
          mediaType: 'website',
          contentType: 'text/html',
          title: 'Auti.sm',
          description: '',
          image: undefined,
          favicon: '',
        },
        error: undefined,
      },
      'should return correct link preview'
    );
  });
});
