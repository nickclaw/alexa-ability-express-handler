import assert from 'assert';
import Promise from 'bluebird';
import request from 'request';
import crypto from 'crypto';
import createDebug from 'debug';
import { parse } from 'url';
import { normalize } from 'path';
import { parseCert } from 'x509';
import startsWith from 'lodash/startsWith';
import includes from 'lodash/includes';
import get from 'lodash/get';
import LRU from 'lru';

const debug = createDebug('alexa-ability-express-handler:verifyRequest');
const MAX_TOLERANCE = 1000 * 60 * 2.5; // 2.5 minutes
const DEFAULT_CACHE_SIZE = 0;
const DEFAULT_CACHE_AGE = 1000 * 60 * 60 * 24; // 1 day
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
    cacheSize = DEFAULT_CACHE_SIZE,
    cacheTime = DEFAULT_CACHE_AGE,
} = {}) {
    const lru = new LRU({
        max: cacheSize,
        maxAge: cacheTime,
    });

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
    function validateUrl(url) {
        const { protocol, hostname, pathname, port } = parse(url);
        const path = normalize(pathname);

        assert.equal(protocol, CERT_PROTO);
        assert.equal(hostname, CERT_HOST);
        assert(startsWith(path, CERT_PATH), `${path} does not start with ${CERT_PATH}`);
        assert.equal(port || CERT_PORT, CERT_PORT);

        debug('valid url: %s', url);

        // return the url to make promise chaining easier
        return url;
    }


    /**
     * Get the x509 certificate from amazon
     *
     * @param {String} url
     * @return {String} certificate
     */
    function getCertificate(url) {
        debug('getting certificate');

        if (lru.peek(url)) {
            debug('found url in cache');
            return Promise.resolve(lru.get(url));
        }

        return new Promise((res, rej) => {
            request(url, (err, resp, body) => {
                if (err) {
                    debug('error getting certificate');
                    return rej(err);
                }

                if (resp.statusCode !== 200) {
                    debug('invalid status code: %s', resp.statusCode);
                    return rej(new Error('Invalid certificate response.'));
                }

                debug('got certificate');
                lru.set(url, body);
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
    function validateCertificate(cert) {
        debug('validating certificate');

        const { altNames, notBefore, notAfter } = parseCert(cert);
        const now = new Date();

        assert(includes(altNames, CERT_ALTNAME), 'Invalid alt names.');
        assert(now > new Date(notBefore), 'Certificate expired.');
        assert(now < new Date(notAfter), 'Certificate expired.');

        debug('valid certificate');

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
    function validateBody(cert, sig, body) {
        debug('checking body against signature');
        const verifier = crypto.createVerify('SHA1');
        verifier.update(JSON.stringify(body));

        if (!verifier.verify(cert, sig, 'base64')) {
            throw new Error('Could not verify request body.');
        }

        debug('signature matches body');
    }

    function verifyRequestMiddleware(req, res, next) {
        // get data
        const chainUrl = req.get(CERT_HEADER);
        const sig = req.get(SIG_HEADER);
        const body = req.body;
        const timestamp = get(body, 'request.timestamp', DEFAULT_TIME);
        debug('cert-url: %s', chainUrl);
        debug('signature: %s', sig);
        debug('timestamp: %s', timestamp);
        debug('checking body: %o', body);

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
                    debug('verified request');
                    next();
                },
                err => {
                    debug('error verifiying request: %s', err);
                    next(err);
                }
            );
    }

    verifyRequestMiddleware.validateUrl = validateUrl;
    verifyRequestMiddleware.getCertificate = getCertificate;
    verifyRequestMiddleware.validateCertificate = validateCertificate;
    verifyRequestMiddleware.validateBody = validateBody;

    return verifyRequestMiddleware;
}
