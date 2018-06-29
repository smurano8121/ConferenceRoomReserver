/**
 * dialog flowからのwebhookを受け取って，ユーザとの対話を行う
 * googleカレンダ部分はgoogleApiAcessに移譲
 */

var express = require('express');
var router = express.Router();

const fs = require('fs');
const mkdirp = require('mkdirp');
const readline = require('readline');
const { google } = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'credentials.json';

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
            // oauth = user[0].oauth;

            fs.readFile('client_secret.json', (err, content) => {
                if (err) return console.log('Error loading client secret file:', err);
                // Authorize a client with credentials, then call the Google Drive API.
                console.log(JSON.parse(content));
                authorize(JSON.parse(content), listEvents);
            });
            res.json({ "fulfillmentText": userName });
        });
    }
    else if (req.body.queryResult.intent.displayName == "予定確認") {
        console.log(oAuth2Client);
        listEvents(oAuth2Client);
        res.json({ "fulfillmentText": "予約を承りました。" });
    }
    else if (req.body.queryResult.intent.displayName == "会議室予約") {
        console.log(req.body.queryResult.intent.displayName);
        fs.readFile('client_secret.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Drive API.
            console.log(JSON.parse(content));
            authorize(JSON.parse(content), insertEvents);
        });
        res.json({ "fulfillmentText": "予定を追加しました" });
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

    function authorize(credentials, callback) {
        const { client_secret, client_id, redirect_uris } = credentials.web;
        let token = {};
        oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);

        // Check if we have previously stored a token.
        try {
            token = fs.readFileSync(TOKEN_PATH);
        } catch (err) {
            res.json({ "fulfillmentText": "トークンを取得できませんでした" });
        }
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    }

    function getAccessToken(oAuth2Client, callback) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        res.redirect(authUrl)
    }




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

    function insertEvents(auth) {
        var calendar = google.calendar('v3');

        var event = {
            'summary': 'APIからの予定登録テスト',
            'description': 'テスト用',
            'start': {
                'dateTime': '2017-12-31T09:00:00',
                'timeZone': 'Asia/Tokyo',
            },
            'end': {
                'dateTime': '2017-12-31T17:00:00',
                'timeZone': 'Asia/Tokyo',
            },
            'attendees': [
                { 'email': 'mikilab.doshisha.ac.jp_33353234353936362d333132@resource.calendar.google.com' }
            ]
        };

        calendar.events.insert({
            auth: auth,
            calendarId: 'primary',
            resource: event,
        }, function (err, event) {
            if (err) {
                console.log('There was an error contacting the Calendar service: ' + err);
                return;
            }
            console.log('Event created: %s', event.htmlLink);
        });
    }
});



module.exports = router;
