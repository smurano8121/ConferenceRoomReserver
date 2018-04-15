var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    console.log("/registrationのGet")
    res.redirect("https://www.yahoo.co.jp/")
});

router.post('/', function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    console.log(req.body)
    console.log(res.statusCode)
    res.json({ "status": "ok" })
});

module.exports = router;
