# alexa-ability-express-handler

### Example

```js
import express from 'express';
import bodyParser from 'body-parser';
import { Ability, intent } from 'alexa-ability';
import handle from 'alexa-ability-lambda-handler';

const ability = new Ability();
ability.on(intent.LAUNCH, function(req) {
    req.say("Testing testing one two three.").send();
});

const app = express();
app.use(bodyParser.json());
app.use('/my-intent', handle(ability));

app.listen(8000, function() {
    
});
```
