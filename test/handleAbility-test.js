import { handleAbility } from '../src/handleAbility';

describe('handleAbility', function() {

    it('should return a middleware function', function() {
        const middleware = handleAbility({});
        expect(middleware).to.be.instanceOf(Function);
        expect(middleware.length).to.equal(3);
    });

    describe('middleware function', function() {

        it('should skip handling if no request body', function() {
            const middleware = handleAbility({});
            const req = {};
            const res = {};
            const next = sinon.spy();

            middleware(req, res, next);
            expect(next).to.be.calledWith();
        });

        it('should return json on success', function() {
            const data = {};
            const request = { toJSON: () => data };
            const middleware = handleAbility({ handle: sinon.spy((e, fn) => fn(null, request)) })
            const req = { body: {}};
            const res = { json: sinon.spy() };
            const next = sinon.spy();

            middleware(req, res, next);
            expect(next).to.not.be.called;
            expect(res.json).to.be.calledWith(data);
        });

        it('should punt error on failure', function() {
            const err = new Error();
            const middleware = handleAbility({ handle: sinon.spy((e, fn) => fn(err)) })
            const req = { body: {}};
            const res = {};
            const next = sinon.spy();
            middleware(req, res, next);
            expect(next).to.be.calledWith(err);
        });
    });
});
