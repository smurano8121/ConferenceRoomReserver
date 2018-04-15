const express = require('express');
const router = express.Router();

const User = require('../models/user');

/* GET home page. */
router.get('/', function (req, res, next) {
    console.log("/registrationのGet")
    res.redirect("https://www.yahoo.co.jp/")
});

router.post('/', function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    console.log(req.body)
    console.log(res.statusCode)

    User.find({ "email": req.body.email }, function (err, result) {
        if (result.length == 0) {
            const user = new User();

            user.email = req.body.email;
            user.name = req.body.name;
            user.password = req.body.password;
            user.studentNumber = req.body.studentNumber;
            user.save(function (err) {
                if (err) console.log(err);
            });
        }
    });
    res.json({ "status": "ok" })
});

module.exports = router;
