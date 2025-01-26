import http from 'k6/http';
import { check } from 'k6';

const testPage = open('./test-page.txt');

export const options = {
  vus: 10,
  duration: '30s',
  rps: 10
};

export default function () {
  const res = http.post('http://localhost:3000/api/rpc', JSON.stringify({
    jsonrpc: '2.0',
    method: 'generatePdf',
    params: { url: testPage },
    id: 1
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body is not an error': (r) => {
      const body = JSON.parse(r.body)
      if (body.error !== undefined) {
        return false
      }
      if (body.result === undefined) {
        return false
      }
      return typeof body.result === 'string'
    },
  });
}
