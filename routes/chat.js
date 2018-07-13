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

const User = require('../models/user');
const Room = require('../models/room');

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


var year;
var month;
var date;

var startTime;
var startHours; 
var startMinutes;
var startSeconds;

var finishHours;
var finishMinutes;
var finishSeconds;

var attendees=' ';

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
        fs.readFile('client_secret.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Drive API.
            console.log(JSON.parse(content));
            authorize(JSON.parse(content), listEvents);
        });
        res.json({ "fulfillmentText": "予約を承りました。" });
    }
    else if (req.body.queryResult.intent.displayName == "会議室予約") {
        console.log(req.body.queryResult.intent.displayName);
        slot.startDateTime = req.body.queryResult.parameters.time[0];
        slot.finishDateTime = req.body.queryResult.parameters.time[1];
        slot.date = req.body.queryResult.parameters.date;
        slot.room = req.body.queryResult.parameters.confernceRoom;

        attendees += '{email: '+  slot.room +'},'
        console.log(slot.startDateTime);
        console.log(slot.finishDateTime);


        var eventDate = new Date(slot.date);
        year = eventDate.getFullYear();
        month = eventDate.getMonth()+1;
        date = eventDate.getDate();

        startTime = new Date(slot.startDateTime);
        startHours = startTime.getHours()+9; //修正必須
        startMinutes = startTime.getMinutes();
        startSeconds = startTime.getSeconds();

        finishTime = new Date(slot.finishDateTime);
        finishHours = finishTime.getHours()+9; //修正必須
        finishMinutes = finishTime.getMinutes();
        finishSeconds = finishTime.getSeconds();

        console.log(slot.date);
        console.log(year);
        console.log(month);
        console.log(date);


        console.log(slot.startDateTime);
        console.log(startHours);
        console.log(startMinutes);
        console.log(startSeconds);

        console.log(slot.finishDateTime);
        console.log(finishHours);
        console.log(finishMinutes);
        console.log(finishSeconds);

        fs.readFile('client_secret.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Drive API.
            console.log(JSON.parse(content));
            authorize(JSON.parse(content), insertEvents);
        });
        
        Room.find({ "address": slot.room }, function (err, result) {
            if (err) throw err;
            res.json({ "fulfillmentText": month+"月"+date+"日の"+startHours+"時"+startMinutes+"分から"+finishHours+"時"+finishMinutes+"分まで"+result[0].name+"を予約します" });
        });
    }
    else if (req.body.queryResult.intent.displayName == "参加者") {
        console.log("参加者");
        console.log(req.body);
        var responseName = '';
        console.log(req.body.queryResult.parameters.userName)
        for(var i=0;i<req.body.queryResult.parameters.userName.length;i++){
            responseName += req.body.queryResult.parameters.userName[i] +"さん";
            console.log(responseName);
            attendees += '{email: '+  req.body.queryResult.parameters.userName[i]+'},'
        }
        res.json({ "fulfillmentText": "参加者は"+responseName+"ですね？合っていれば予約日時と場所を教えてください"});
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
                'dateTime': year+"-"+month+"-"+date+"T"+startHours+":"+startMinutes+":"+startSeconds,
                'timeZone': 'Asia/Tokyo',
            },
            'end': {
                'dateTime': year+"-"+month+"-"+date+"T"+finishHours+":"+finishMinutes+":"+finishSeconds,
                'timeZone': 'Asia/Tokyo',
            },
            'attendees': [
                // { 'email': slot.room }
                attendees
            ]
        };

        console.log(event);

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
