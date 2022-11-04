import 'isomorphic-fetch';
import tape from 'tape';
import sinon from 'sinon';
import HttpService from '.';
import { newRequest, newResponse, stubCall, stubFetch } from '../../util/testUtils';
import { post } from './_fixtures';

// FIXME
tape.skip('HTTPService - get preview', async t => {
  const http = new HttpService();
  const [call, stubs] = stubCall(http);
  const res = newResponse();

  const getStub = sinon.stub(http.app, 'get');
  sinon.stub(http.app, 'post');

  http.addRoutes();

  const getPreviewParams = getStub.args[23];
  // @ts-ignore
  const getPreviewHandler: any = getPreviewParams[1];
  const getPreviewRequest = newRequest(null, null, { link: 'https://auti.sm' });
  await getPreviewHandler(getPreviewRequest, res);

  t.equal(getPreviewParams[0], '/preview', 'should listen to correct path');

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
    'should return correct result from interep'
  );

  t.end();
});

// tape('EXIT', t => {
//   t.end();
//   process.exit(0);
// });
