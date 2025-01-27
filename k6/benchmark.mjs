import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import http from 'k6/http';
import { b64encode } from 'k6/encoding';
import { check } from 'k6';

export const options = {
  vus: 100, // virtual users
  rps: 100, // requests per second
  duration: '300s',
};


const convertToBase64 = (html) => {
  return `data:text/html;base64,${b64encode(html)}`;
}

const URL = 'https://pdf-generator.debian-k3s/api/rpc';
//const URL = 'http://localhost:3000/api/rpc';
const TEST_BODY = open('./assets/test-body.html');
const TEST_HEADER = open('./assets/test-header.html');
const TEST_FOOTER = open('./assets/test-footer.html');

const TEST_PDF_OPTIONS = {
  "format": "letter",
  "printBackground": true,
  "displayHeaderFooter": true,
  "margin": {
      "top": "160px",
      "bottom": "140px"
  },
  "headerTemplate": TEST_HEADER,
  "footerTemplate": TEST_FOOTER
};

export default function () {
  const res = http.post(URL, JSON.stringify({
    jsonrpc: '2.0',
    method: 'generatePdf',
    params: { 
      url: convertToBase64(TEST_BODY),
      pdfOptions: TEST_PDF_OPTIONS
    },
    id: uuidv4()
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body is not an error': (r) => {
      if (r.body === undefined) {
        console.error(`r.body === undefined`)
        return false
      }
      if (r.body === null) {
        console.error(`r.body === null`)
        return false
      }
      if (typeof r.body !== 'string') {
        console.error(`typeof r.body !== 'string': ${r.body}`)
        return false
      }
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

