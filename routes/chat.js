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

const User = require('../models/user');
const Room = require('../models/room');

const googleCalenderEventControler = require('../public/javascripts/server/googleCalenderAccess');

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

var attendees; //会議参加者格納Object

/* GET home page. */
router.get('/', function (req, res, next) {
    ret = { "speech": "きたよ" };
    res.json(ret);
});

/* POST home page. */
router.post('/webhook', function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');

    if (req.body.queryResult.intent.displayName == "会議室予約") {
        console.log(req.body.queryResult.intent.displayName);
        slot.startDateTime = req.body.queryResult.parameters.time[0];
        slot.finishDateTime = req.body.queryResult.parameters.time[1];
        slot.date = req.body.queryResult.parameters.date;
        slot.room = req.body.queryResult.parameters.confernceRoom;

        attendees.push({'email': slot.room });//会議参加者としてリソースである会議室のリソースアドレスを格納

        var eventDate = new Date(slot.date);
        year = eventDate.getFullYear();
        month = eventDate.getMonth()+1;
        date = eventDate.getDate();

        startTime = new Date(slot.startDateTime);
        startHours = startTime.getHours()+9; //修正必須（new Dateすると絶対にUTC標準時刻になってしまう）
        startMinutes = startTime.getMinutes();
        startSeconds = startTime.getSeconds();

        finishTime = new Date(slot.finishDateTime);
        finishHours = finishTime.getHours()+9; //修正必須
        finishMinutes = finishTime.getMinutes();
        finishSeconds = finishTime.getSeconds();

        console.log("予約日: " + year + "年" + month + "月" + date + "日");
        console.log("開始時刻: " + startHours + "時" + startMinutes + "分");
        console.log("終了時刻: " + finishHours + "時" + finishMinutes + "分");

        fs.readFile('client_secret.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            authorize(JSON.parse(content), googleCalenderEventControler.insertEvents);
        });
        
        Room.find({ "address": slot.room }, function (err, result) {
            if (err) throw err;
            res.json({ "fulfillmentText": month+"月"+date+"日の"+startHours+"時"+startMinutes+"分から"+finishHours+"時"+finishMinutes+"分まで"+result[0].name+"を予約します" });
        });
    }
    else if (req.body.queryResult.intent.displayName == "参加者") {
        console.log("参加者");
        let attendeesListFromDialogFlow = req.body.queryResult.parameters.userName;
        var responseName = '';
        attendees = [];
        
        attendeesListFromDialogFlow.forEach(attendeeMail => {
            responseName += attendeeMail +"さん";
            console.log(responseName);
            var addData = { 'email' : attendeeMail };
            attendees.push(addData) ;
        });
        res.json({ "fulfillmentText": "参加者は"+responseName+"ですね？合っていれば予約日時と場所を教えてください"});
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
