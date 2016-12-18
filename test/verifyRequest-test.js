import { verifyRequest } from '../src/verifyRequest';
import fs from 'fs';

const cert = fs.readFileSync(__dirname + '/fixtures/certificate.txt').toString();
const sig = fs.readFileSync(__dirname + '/fixtures/signature.txt').toString();
const body = require('./fixtures/request.json');

describe('verifyRequest', function() {

    it('should return a middleware function', function() {
        const middleware = verifyRequest();
        expect(middleware).to.be.instanceOf(Function);
        expect(middleware.length).to.equal(3);
    });

    describe('middleware function', function() {

        it('should require the proper headers to be present', function() {
            const middleware = verifyRequest();
            const next = sinon.spy();
            const req = { // TODO fix these god awful stubs
                get(header) { return this.headers[header.toLowerCase()] },
                headers: {},
                body
            };
            middleware(req, null, next);
            expect(next.args[0][0]).to.be.instanceOf(Error);
        });

        it('should require a body to be present', function() {
            const middleware = verifyRequest();
            const next = sinon.spy();
            const req = { // TODO fix these god awful stubs
                get(header) { return this.headers[header.toLowerCase()] },
                headers: {
                    SignatureCertChainUrl: 'asdasfas',
                    Signature: 'asdfasfdas'
                }
            };
            middleware(req, null, next);
            expect(next.args[0][0]).to.be.instanceOf(Error);
        });

        it('should require a valid timestamp', function() {
            const middleware = verifyRequest();
            const next = sinon.spy();
            const req = { // TODO fix these god awful stubs
                get(header) { return this.headers[header.toLowerCase()] },
                headers: {
                    SignatureCertChainUrl: 'asdasfas',
                    Signature: 'asdfasfdas'
                },
                body: { request: { timestamp: new Date(0).toISOString() } }
            };

            middleware(req, null, next);
            expect(next.args[0][0]).to.be.instanceOf(Error);
        });

        // TODO better tests
    });
});

describe('validateUrl step', function() {
    const { validateUrl } = verifyRequest();

    [   'https://s3.amazonaws.com/echo.api/echo-api-cert.pem',
        'https://s3.amazonaws.com:443/echo.api/echo-api-cert.pem',
        'https://s3.amazonaws.com/echo.api/../echo.api/echo-api-cert.pem'
    ].forEach(url => {
        it(`should accept: "${url}"`, function() {
            expect(() => validateUrl(url)).to.not.throw();
        });
    });

    [   'http://s3.amazonaws.com/echo.api/echo-api-cert.pem',
        'https://notamazon.com/echo.api/echo-api-cert.pem',
        'https://s3.amazonaws.com/EcHo.aPi/echo-api-cert.pem',
        'https://s3.amazonaws.com/invalid.path/echo-api-cert.pem',
        'https://s3.amazonaws.com:563/echo.api/echo-api-cert.pem'
    ].forEach(url => {
        it(`should not accept: "${url}"`, function() {
            expect(() => validateUrl(url)).to.throw();
        });
    });
});

describe('validateCertificate step', function() {
  const { validateCertificate } = verifyRequest();

});

describe('validateBody step', function() {
    const { validateBody } = verifyRequest();

    it('should not work with an invalid setup', function() {
        expect(() => validateBody(cert, 'asdfasfaf', body)).to.throw();
    });

    it('should work with a valid setup', function() {
        validateBody(cert, sig, body);
    });
});
