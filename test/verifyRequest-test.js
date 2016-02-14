import {
    verifyRequest,
    validateUrl,
    validateCertificate,
    validateBody
} from '../src/verifyRequest';
import fs from 'fs';

const cert = fs.readFileSync(__dirname + '/fixtures/certificate.txt').toString();
const sig = fs.readFileSync(__dirname + '/fixtures/signature.txt').toString();
const body = require('./fixtures/request.json');

describe('verifyRequest', function() {

});

describe('validateUrl step', function() {
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

});

describe('validateBody step', function() {
    it('should not work with an invalid setup', function() {
        expect(() => validateBody(cert, sig + 's', body)).to.throw();
    });

    it('should work with a valid setup', function() {
        validateBody(cert, sig, body);
    });
});
