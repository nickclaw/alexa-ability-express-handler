import assert from 'assert';
import Promise from 'bluebird';
import request from 'request';
import crypto from 'crypto';
import debug from 'debug';
import { parse } from 'url';
import { normalize } from 'path';
import { parseCert } from 'x509';
import startsWith from 'lodash/startsWith';
import includes from 'lodash/includes';
import get from 'lodash/get';

const log = debug('express-handler:verifyRequest');
const MAX_TOLERANCE = 60 * 2.5 * 1000; // 2.5 minutes
const CERT_HEADER = 'SignatureCertChainUrl';
const SIG_HEADER = 'Signature';
const DEFAULT_TIME = new Date(0).toISOString();
const CERT_PROTO = 'https:';
const CERT_HOST = 's3.amazonaws.com';
const CERT_PORT = 443;
const CERT_PATH = '/echo.api/';
const CERT_ALTNAME = 'echo-api.amazon.com';

export function verifyRequest({
    tolerance = MAX_TOLERANCE,
} = {}) {
    return function verifyRequestMiddleware(req, res, next) {
        // get data
        const chainUrl = req.headers[CERT_HEADER];
        const sig = req.headers[SIG_HEADER];
        const body = req.body;
        const timestamp = get(body, 'request.timestamp', DEFAULT_TIME);
        log('cert-url: %s', chainUrl);
        log('signature: %s', sig);
        log('timestamp: %s', timestamp);
        log('checking body: %o', body);

        // basic checks
        if (!chainUrl) return next(new Error('No SignatureCertChainUrl header provided.'));
        if (!sig) return next(new Error('No Signature header provided.'));
        if (!body) return next(new Error('No body provided.'));

        // check timestamp
        const diff = Math.abs(new Date(timestamp).valueOf() - new Date().valueOf());
        if (diff > tolerance) {
            return next(new Error(
                'Request timestamp is outside of allowed tolerance.'
            ));
        }

        // validation
        Promise.resolve(chainUrl)
            .then(validateUrl)
            .then(getCertificate)
            .then(validateCertificate)
            .then(cert => validateBody(cert, sig, body))
            .then(
                () => {
                    log('verified request');
                    next();
                },
                err => {
                    log('error verifiying request: %s', err);
                    next(err);
                }
            );
    };
}

/**
 * Validates that the certificate url is valid, as defined by
 * https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/developing-an-alexa-skill-as-a-web-service#verifying-the-signature-certificate-url
 *
 * Basically the rules are:
 *   1. The protocol is equal to https (case insensitive).
 *   2. The hostname is equal to s3.amazonaws.com (case insensitive).
 *   3. The normalized path starts with /echo.api/ (case sensitive).
 *   4. If a port is defined in the URL, the port is equal to 443.
 *
 * @param {String} url
 * @return {String} url
 */
export function validateUrl(url) {
    const { protocol, hostname, pathname, port } = parse(url);
    const path = normalize(pathname);

    assert.equal(protocol, CERT_PROTO);
    assert.equal(hostname, CERT_HOST);
    assert(startsWith(path, CERT_PATH), `${path} does not start with ${CERT_PATH}`);
    assert.equal(port || CERT_PORT, CERT_PORT);

    log('valid url: %s', url);

    // return the url to make promise chaining easier
    return url;
}


/**
 * Get the x509 certificate from amazon
 * TODO cache some number of certs
 *
 * @param {String} url
 * @return {String} certificate
 */
export function getCertificate(url) {
    log('getting certificate');

    return new Promise((res, rej) => {
        request(url, (err, resp, body) => {
            if (err) {
                log('error getting certificate');
                return rej(err);
            }

            if (resp.statusCode !== 200) {
                log('invalid status code: %s', resp.statusCode);
                return rej(new Error('Invalid certificate response.'));
            }

            log('got certificate');
            res(body);
        });
    });
}

/**
 * Validate a certificate, as defined by:
 * https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/developing-an-alexa-skill-as-a-web-service#Checking the Signature of the Request
 * @param {String} cert
 * @return {String} cert
 */
export function validateCertificate(cert) {
    log('validating certificate');

    const { altNames, notBefore, notAfter } = parseCert(cert);
    const now = new Date();

    assert(includes(altNames, CERT_ALTNAME), 'Invalid alt names.');
    assert(now > new Date(notBefore), 'Certificate expired.');
    assert(now < new Date(notAfter), 'Certificate expired.');

    log('valid certificate');

    // return cert to make promise chaining easier
    return cert;
}

/**
 * Check the body against the signature and validated cert
 * TODO do we need to check against raw body?
 * @param {String} cert
 * @param {String} sig
 * @param {Object} body
 */
export function validateBody(cert, sig, body) {
    log('checking body against signature');
    const verifier = crypto.createVerify('SHA1');
    verifier.update(JSON.stringify(body));

    if (!verifier.verify(cert, sig, 'base64')) {
        throw new Error('Could not verify request body.');
    }

    log('signature matches body');
}
