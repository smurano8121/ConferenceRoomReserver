/**
 * dialog flowからのwebhookを受け取って，ユーザとの対話を行う
 * googleカレンダ部分はgoogleApiAcessに移譲
 */

var express = require('express');
var router = express.Router();

var fs = require('fs');
var readline = require('readline');
const { google } = require('googleapis');
const googleAuth = require('google-auth-library');
const request = require('request');

let userName;
let userOauth;

let eventSummary = null;
let eventDate = null;
let eventStartTime = null;
let eventFinishTime = null;

const apiKey = "624f4a595336427033477236324a6a476e754170304868636b584d61596335315150517a6d724e4e466837";
let talkContext = null;

let slot = {
    name: null,
    date: null,
    startDateTime: null,
    finishDateTime: null,
    eventSummary: null,
    room: null,
}


/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

/* POST home page. */
router.post('/webhook', function (req, res, next) {
    console.log(req.body);
    if (req.body.result.metadata.intentName == "名前") {
        User.find({ "name": req.body.result.parameters.name }, function (err, user) {
            userName = user[0].name;
            userOauth = user[0].oauth;
        });
    }
    else if (req.body.result.metadata.intentName == "予定追加") {

    }
    else if (req.body.result.metadata.intentName == "予定概要入力") {

    }
    else if (req.body.result.metadata.intentName == "予定開始日入力") {

    }
    else if (req.body.result.metadata.intentName == "予定時間入力") {

    }
    else if (req.body.result.metadata.intentName == "予定確認") {

    }


    function checkSlotFulfilled(slot) {
        if (!slot.name || !slot.date || !slot.startDateTime || !slot.finishDateTime || !slot.eventSummary || !slot.room) {
            return false;
        }
    }
});



module.exports = router;
