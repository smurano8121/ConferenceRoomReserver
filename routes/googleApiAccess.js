var express = require('express');
var router = express.Router();

const User = require('../models/user');

const { google } = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
var oAuth2Client = new OAuth2Client(null, null, null);


/* GET users listing. */
router.post('/check', function (req, res, next) {

    User.find({ "name": req.body.name }, function (err, user) {
        if (err) console.log(err);
        oauth = user[0].oauth;
        // var oauth2Client = new auth.OAuth2(oauth.clientId_ ,oauth.clientSecret_, oauth.redirectUri_);
        oAuth2Client.clientId_ = oauth.clientId_;
        oAuth2Client.clientSecret_ = oauth.clientSecret_;
        oAuth2Client.redirectUri_ = oauth.redirectUri_;
        oAuth2Client.credentials = oauth.credentials;
        // oauth2Client.transporter = DefaultTransporter {}; 本来はtransporterも格納しないといけないが，なしでもいけた
        oAuth2Client.opts = oauth.opts;

        console.log(oAuth2Client);
        listEvents(oAuth2Client);
        res.json({ "fulfillmentText": "予約を承りました。" });
    });


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




router.get('/', function (req, res, next) {
    console.log("in chat");

    const testPass = "password";
    const testUserId = "test";
    const testUserName = "testUser";
    var oauth = null;
    var buf = null;


    User.find({ "userid": testUserId }, function (err, user) {
        if (err) console.log(err);
        oauth = user[0].oauth;
        // var oauth2Client = new auth.OAuth2(oauth.clientId_ ,oauth.clientSecret_, oauth.redirectUri_);
        oAuth2Client.clientId_ = oauth.clientId_;
        oAuth2Client.clientSecret_ = oauth.clientSecret_;
        oAuth2Client.redirectUri_ = oauth.redirectUri_;
        oAuth2Client.credentials = oauth.credentials;
        // oauth2Client.transporter = DefaultTransporter {}; 本来はtransporterも格納しないといけないが，なしでもいけた
        oAuth2Client.opts = oauth.opts;

        console.log(oAuth2Client);
        listEvents(oAuth2Client);
        insertEvents(oAuth2Client);
        res.redirect("https://ec2-13-115-41-122.ap-northeast-1.compute.amazonaws.com:3000/chat/room");
    });


    function insertEvents(auth, eventSummary, eventDate, startDateTime, finishDateTime) {
        var calendar = google.calendar('v3');

        if (startDateTime == null && finishDateTime == null) {//開始・終了時間がない場合
            var event = {
                'summary': eventSummary,
                'description': 'テスト用',
                'start': {
                    'date': eventDate,
                    'timeZone': 'Asia/Tokyo',
                },
                'end': {
                    'date': eventDate,
                    'timeZone': 'Asia/Tokyo',
                },
                'attendees': [
                    { 'email': 'tshimakawa@mikilab.doshisha.ac.jp' }
                ]
            };
        } else {//開始終了時間がある場合
            var event = {
                'summary': eventSummary,
                'description': 'テスト用',
                'start': {
                    'dateTime': startDateTime,
                    'timeZone': 'Asia/Tokyo',
                },
                'end': {
                    'dateTime': finishDateTime,
                    'timeZone': 'Asia/Tokyo',
                },
                // 'attendees': [
                //     {'email': 'tshimakawa@mikilab.doshisha.ac.jp'}
                //   ]
            };
        }

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
                { 'email': 'tshimakawa@mikilab.doshisha.ac.jp' }
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


router.get('/room', function (req, res, next) {
    console.log("roomだよ〜");
});


router.post('/', function (req, res, next) {
    console.log("in chat");
    console.log(req.body);
    res.send('respond with a resource');
});





module.exports = router;
