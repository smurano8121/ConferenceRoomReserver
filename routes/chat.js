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
var oAuth2Client = new google.auth.OAuth2(null, null, null);


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

    if (req.body.queryResult.intent.displayName == "名前") {
        User.find({ "name": req.body.queryResult.parameters.userName }, function (err, user) {
            userName = user[0].name;
            oauth = user[0].oauth;
            // oAuth2Client = oauth;


            oAuth2Client._clientId = oauth._clientId;
            oAuth2Client._clientSecret = oauth._clientSecret;
            oAuth2Client.redirectUri = oauth.redirectUri;
            oAuth2Client.credentials = oauth.credentials;
            // oauth2Client.transporter = DefaultTransporter {}; 本来はtransporterも格納しないといけないが，なしでもいけた
            // oAuth2Client.opts = oauth.opts;



            res.json({ "fulfillmentText": userName });
        });
    }
    else if (req.body.queryResult.intent.displayName == "予定確認") {
        console.log(oAuth2Client);
        listEvents(oAuth2Client);
        res.json({ "fulfillmentText": "予約を承りました。" });
    }
    else if (req.body.queryResult.intent.displayName == "予定追加") {

    }
    else if (req.body.queryResult.intent.displayName == "予定概要入力") {

    }
    else if (req.body.queryResult.intent.displayName == "予定開始日入力") {

    }
    else if (req.body.queryResult.intent.displayName == "予定時間入力") {

    }



    // function checkSlotFulfilled(slot) {
    //     if (!slot.name || !slot.date || !slot.startDateTime || !slot.finishDateTime || !slot.eventSummary || !slot.room) {
    //         return false;
    //     }
    // }




    function listEvents(auth, startDate, callback) {
        const calendar = google.calendar({ version: 'v3', auth });
        calendar.events.list({
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        }, (err, { data }) => {
            if (err) return console.log('The API returned an error: ' + err);
            const events = data.items;
            if (events.length) {
                console.log('Upcoming 10 events:');
                events.map((event, i) => {
                    const start = event.start.dateTime || event.start.date;
                    console.log(`${start} - ${event.summary}`);
                });
            } else {
                console.log('No upcoming events found.');
            }
        });
    }
});



module.exports = router;
