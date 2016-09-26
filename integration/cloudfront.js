"use strict"

require("../dist/lambda").cloudfront({}, null, (err, data) => {
    if (err) {
        console.error(err);
    } else {
        console.log(data);
    }
});
