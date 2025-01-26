import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import http from 'k6/http';
import { check } from 'k6';

const URL = 'https://pdf-generator.debian-k3s/api/rpc';
//const URL = 'http://localhost:3000/api/rpc';
const TEST_PAGE = open('./test-page.txt');

export const options = {
  vus: 100, // virtual users
  rps: 100, // requests per second
  duration: '300s',
};

export default function () {
  const res = http.post(URL, JSON.stringify({
    jsonrpc: '2.0',
    method: 'generatePdf',
    params: { url: TEST_PAGE },
    id: uuidv4()
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body is not an error': (r) => {
      let body = null
      try {
        body = JSON.parse(r.body)
      } catch (err) {
        console.error(`failed to JSON.parse: ${err.message}`)
        return false
      }
      if (body.error !== undefined) {
        console.error(`body.error !== undefined: ${JSON.stringify(body)}`)
        return false
      }
      if (body.result === undefined) {
        console.error(`body.result === undefined: ${JSON.stringify(body)}`)
        return false
      }
      if (typeof body.result !== 'string') {
        console.error(`body.result !== string: ${JSON.stringify(body)}`)
        return false
      }
      return true
    },
  });
}

