# alexa-ability-express-handler [![Build Status](https://travis-ci.org/nickclaw/alexa-ability-express-handler.svg?branch=master)](https://travis-ci.org/nickclaw/alexa-ability-express-handler)

### Example

```js
import express from 'express';
import bodyParser from 'body-parser';
import { Ability, events } from 'alexa-ability';
import { verifyRequest, handleAbility } from 'alexa-ability-express-handler';

// build skill
const ability = new Ability();
ability.on(events.launch, function(req) {
    req.say("Testing testing one two three.").end();
});

const app = express();
app.use(bodyParser.json());
app.use(verifyRequest());
app.post('/my-intent', handleAbility(ability));

app.listen(8000, function() {
    console.log('listening');
});
```

### API

##### `verifyRequest(options) -> express middleware`
Creates a middleware function for express that implements the body verification process
required by Amazon for certification. Takes an optional options object with the
following values:
 - `tolerance`: only accept requests with a timestamp within the given tolerance.
   Value defaults to 2.5 minutes in milliseconds.

##### `handleAbility(ability) -> express handler`
Creates an express handler for the given ability.
