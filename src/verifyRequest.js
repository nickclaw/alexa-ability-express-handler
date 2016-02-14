import assert from 'assert';
import Promise from 'bluebird';
import request from 'request';
import crypto from 'crypto';
import { parse } from 'url';
import { normalize } from 'path';
import { parseCert } from 'x509';
import startsWith from 'lodash/startsWith';
import includes from 'lodash/includes';

const CERT_HEADER = 'SignatureCertChainUrl';
const SIG_HEADER = 'Signature';

export function verifyRequest() {
    return function verifyRequestMiddleware(req, res, next) {
        const chainUrl = req.headers[CERT_HEADER];
        const sig = req.headers[SIG_HEADER];
        const body = req.body;

        return Promise.resolve(chainUrl)
            .then(validateUrl)
            .then(getCertificate)
            .then(validateCertificate)
            .then(cert => validateBody(cert, sig, body))
            .then(
                () => next(),
                err => next(err)
            );
    };
}

export function validateUrl(url) {
    const { protocol, hostname, pathname, port } = parse(url);
    const path = normalize(pathname);

    assert.equal(protocol, 'https:');
    assert.equal(hostname, 's3.amazonaws.com');
    assert(startsWith(path, '/echo.api/'), `${path} does not start with /echo.api/`);
    assert.equal(port || 443, 443);

    return url;
}


export function getCertificate(url) {
    return new Promise((res, rej) => {
        request(url, (err, resp, body) => {
            if (err) return rej(err);
            if (resp.statusCode !== 200) return rej(new Error());
            res(body);
        });
    });
}

export function validateCertificate(cert) {
    const { altNames, notBefore, notAfter } = parseCert(cert);
    const now = new Date();

    assert(includes(altNames, 'echo-api.amazon.com'), 'Invalid alt names.');
    assert(now > new Date(notBefore), 'Certificate expired.');
    assert(now < new Date(notAfter), 'Certificate expired.');

    return cert;
}

export function validateBody(cert, sig, body) {
    const verifier = crypto.createVerify('SHA1');
    verifier.update(JSON.stringify(body));

    if (!verifier.verify(cert, sig, 'base64')) {
        throw new Error();
    }
}
