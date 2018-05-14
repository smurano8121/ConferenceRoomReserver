/**
 * dialog flowからのwebhookを受け取って，ユーザとの対話を行う
 * googleカレンダ部分はgoogleApiAcessに移譲
 */

var express = require('express');
var router = express.Router();

var fs = require('fs');
var readline = require('readline');
const request = require('request');

let userName;
let userOauth;

let eventSummary = null;
let eventDate = null;
let eventStartTime = null;
let eventFinishTime = null;

let slot = {
    name: null,
    date: null,
    startDateTime: null,
    finishDateTime: null,
    eventSummary: null,
    room: null,
}

const User = require('../models/user');

const { google } = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
var oAuth2Client = new OAuth2Client(null, null, null);


/* GET home page. */
router.get('/', function (req, res, next) {
    ret = { "speech": "きたよ" };
    res.json(ret);
});

/* POST home page. */
router.post('/webhook', function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    console.log("webhookきたよ");
    console.log(req.body);
    // console.log(req.body.queryResult.intent.displayName);

    if (req.body.queryResult.intent.displayName == "名前") {
        User.find({ "name": req.body.queryResult.parameters.userName }, function (err, user) {
            userName = user[0].name;
            oauth = user[0].oauth;

            console.log(userName);
            console.log(oauth);


            oAuth2Client.clientId_ = oauth.clientId_;
            oAuth2Client.clientSecret_ = oauth.clientSecret_;
            oAuth2Client.redirectUri_ = oauth.redirectUri_;
            oAuth2Client.credentials = oauth.credentials;
            // oauth2Client.transporter = DefaultTransporter {}; 本来はtransporterも格納しないといけないが，なしでもいけた
            oAuth2Client.opts = oauth.opts;

            console.log(oAuth2Client);

            res.json({ "fulfillmentText": userName });
        });


        User.find({ "name": req.body.name }, function (err, user) {




        });



    }
    else if (req.body.queryResult.intent.displayName == "予定確認") {
        listEvents(oAuth2Client);
        res.json({ "fulfillmentText": "予約を承りました。" });
    }
    // else if (req.body.queryResult.intent.displayName == "予定追加") {

    // }
    // else if (req.body.queryResult.intent.displayName == "予定概要入力") {

    // }
    // else if (req.body.queryResult.intent.displayName == "予定開始日入力") {

    // }
    // else if (req.body.queryResult.intent.displayName == "予定時間入力") {

    // }



    // function checkSlotFulfilled(slot) {
    //     if (!slot.name || !slot.date || !slot.startDateTime || !slot.finishDateTime || !slot.eventSummary || !slot.room) {
    //         return false;
    //     }
    // }




    function listEvents(auth, startDate, callback) {
        var calendar = google.calendar('v3');
        calendar.events.list({
            auth: auth,
            calendarId: 'primary',
            timeMin: startDate + "T00:00:00+09:00",//timeMinとtimeMaxを設定することでその区間の予定のみを検索
            timeMax: startDate + "T23:59:59+09:00",
            maxResults: 10,//最大検索件数
            singleEvents: true,
            orderBy: 'startTime'//開始時間順に並べ替え
        }, function (err, response) {
            if (err) {
                console.log('The API returned an error: ' + err);
                return;
            }
            var events = response.items;
            var eventList = [];
            if (events.length == 0) {
                callback(eventList);
            } else {
                for (var i = 0; i < events.length; i++) {
                    var event = events[i];
                    eventList.push(events[i]);
                }
                callback(eventList);
            }
        });
    }
});



module.exports = router;
