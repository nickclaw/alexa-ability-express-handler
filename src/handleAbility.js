import once from 'lodash/once';
import debug from 'debug';

const log = debug('alexa-ability-express-handler:handleAbility');

const noBodyWarning = once(() => console.log( // eslint-disable-line no-console
    'Warning: No request body found.'
));

export function handleAbility(ability) {
    // return express middleware
    return function abilityHandler(req, res, next) {
        // make sure we have a body
        if (!req.body) {
            noBodyWarning();
            return next();
        }

        log('handling %o', req.body);
        ability.handle(req.body, (err, request) => {
            if (err) {
                log('request failed: %s', err);
                next(err);
            } else {
                const response = request.toJSON();
                log('request succeeded, sending %o', response);
                res.json(response);
            }
        });
    };
}
