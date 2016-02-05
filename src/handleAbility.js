import once from 'lodash/once';

export function handleAbility(ability) {
    return function abilityHandler(req, res, next) {
        // make sure we have a body
        if (!req.body) {
            noBodyWarning();
            return next();
        }

        // TODO validate body? or should ability handle that..
        ability.handle(req.body, (err, request) => {
            if (err) return next(err);
            res.json(request.toJSON());
        });
    };
}


//
// Misc warnings
//

const noBodyWarning = once(() => console.log( // eslint-disable-line no-console
    'Warning: No request body found.'
));
