import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import http from 'k6/http';
import { check } from 'k6';

const testPage = open('./test-page.txt');

export const options = {
  vus: 40, // virtual users
  rps: 40, // requests per second
  duration: '30s',
};

export default function () {
  const res = http.post('https://pdf-generator.debian-k3s/api/rpc', JSON.stringify({
    jsonrpc: '2.0',
    method: 'generatePdf',
    params: { url: testPage },
    id: uuidv4()
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
        console.error(body.error)
        return false
      }
      if (body.result === undefined) {
        console.error(body)
        return false
      }
      if (typeof body.result !== 'string') {
        console.error(body)
        return false
      }
      return true
    },
  });
}

