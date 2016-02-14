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
