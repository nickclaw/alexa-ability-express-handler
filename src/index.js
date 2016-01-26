import once from 'lodash/once';

export default function createAbilityHandler(ability) {

    return function(req, res, next) {

        // make sure we have a body
        if (!req.body) {
            noBodyWarning();
            return next();
        }

        // TODO validate body? or should ability handle that..

        ability.handle(req.body).then(
            request => res.json(request.toJSON()),
            err => next(err)
        );
    }
}


//
// Misc warnings
//

const noBodyWarning = once(() => console.log('Warning: No request body found.'));
