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

const testPass = "password";
const testUserId = "test";
const testUserName = "testUser";

let eventSummary = null;
let eventDate = null;
let eventStartTime = null;
let eventFinishTime = null;

const apiKey = "624f4a595336427033477236324a6a476e754170304868636b584d61596335315150517a6d724e4e466837";
let talkContext = null;


/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

/* POST home page. */
router.post('/webhook', function (req, res, next) {
    console.log("Date：" + req.body.result.parameters.date);
    console.log("Time：" + req.body.result.parameters.time);
    console.log("Room：" + req.body.result.parameters.ConferenceRoom);

    let startDate = req.body.result.parameters.date;
    let startTime = req.body.result.parameters.time;
    let ConferenceRoom = req.body.result.parameters.ConferenceRoom;

    var SCOPES = ['https://www.googleapis.com/auth/calendar'];
    var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
    var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

    // Load client secrets from a local file.
    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Calendar API.
        authorize(JSON.parse(content));
    });

    function authorize(credentials) {
        var clientSecret = credentials.installed.client_secret;
        var clientId = credentials.installed.client_id;
        // var redirectUrl = credentials.installed.redirect_uris[0];
        var redirectUrl = 'http://ec2-13-115-41-122.ap-northeast-1.compute.amazonaws.com:3000/auth/token';
        var auth = new googleAuth();
        var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

        // Check if we have previously stored a token.
        fs.readFile(TOKEN_PATH, function (err, token) {
            if (err) {//Tokenがない場合は新たにTokenを取得
                getNewToken(oauth2Client);
            } else {//Tokenをすでに持っている場合
                oauth2Client.credentials = JSON.parse(token);
                if (req.body.result.metadata.intentName == "予定を入れて") {//Dialogflowの「予定を入れて」インテントからwebhook	      
                    ret = { "speech": "どんな予定ですか？" };
                    res.json(ret);

                } else if (req.body.result.metadata.intentName == "予定概要") {//Dialogflowの「予定概要」インテントからwebhook．ここではsummary（カレンダ上ではタイトル）を設定
                    eventSummary = req.body.result.resolvedQuery;//eventSummaryに入力文字列をそのまま追加
                    if (eventDate == null) {//予定の日程が設定されていない場合
                        ret = { "speech": "いつの予定ですか？" };
                        res.json(ret);
                    } else if (eventStartTime == null) {//予定の開始時間が設定されていない場合
                        ret = { "speech": "その予定は何時からですか？" };
                        res.json(ret);
                    } else if (eventFinishTime == null) {//予定の終了時間が設定されていない場合
                        ret = { "speech": "その予定は何時に終わりますか？" };
                        res.json(ret);
                    } else {//予定の日程が設定されて入れば予定を追加
                        insertEvents(oauth2Client, eventSummary, eventDate, eventStartTime, eventFinishTime);
                        ret = { "speech": eventDate + "の" + eventStartTime + "から" + eventFinishTime + "まで" + eventSummary + "を追加します" };
                        res.json(ret);
                        eventSummary = null;
                        eventDate = null;
                    }

                } else if (req.body.result.metadata.intentName == "予定開始日") {//Dialogflowの「予定開始日」インテントからのwebhook．ここではdateの設定
                    eventDate = req.body.result.parameters.date;
                    if (eventSummary == null) {//予定のタイトルが設定されていない場合
                        ret = { "speech": "どんな予定ですか？" };
                        res.json(ret);
                    } else if (eventStartTime == null) {//予定の開始時間が設定されていない場合
                        ret = { "speech": "その予定は何時からですか？" };
                        res.json(ret);
                    } else if (eventFinishTime == null) {//予定の終了時間が設定されていない場合
                        ret = { "speech": "その予定は何時に終わりますか？" };
                        res.json(ret);
                    } else {
                        insertEvents(oauth2Client, eventSummary, eventDate, eventStartTime, eventFinishTime);
                        ret = { "speech": eventDate + "の" + eventStartTime + "から" + eventFinishTime + "まで" + eventSummary + "を追加します" };
                        res.json(ret);
                        eventSummary = null;
                        eventDate = null;
                        eventStartTime = null;
                        eventFinishTime = null;
                    }

                } else if (req.body.result.metadata.intentName == "予定時間") {//Dialogflowの「予定時間」からのwebhook．ここでは予定の開始・終了時間を設定
                    if (eventStartTime == null && eventFinishTime == null) {//開始・終了時間がない場合
                        eventStartTime = req.body.result.parameters.time;
                        //開始時間の入力が終わったら終了時間を聞く
                        ret = { "speech": "その予定は何時までですか？" };
                        res.json(ret);
                    } else if (eventFinishTime == null) {//終了時間がない場合
                        eventFinishTime = req.body.result.parameters.time;
                        let startDateTime = eventDate + "T" + eventStartTime;//開始時刻をgoogle calendar APIで使う形に変換（yyyy-mm-ddThh:mm:ss）
                        let finishDateTime = eventDate + "T" + eventFinishTime;//終了時刻をgoogle calendar APIで使う形に変換（yyyy-mm-ddThh:mm:ss）

                        insertEvents(oauth2Client, eventSummary, eventDate, startDateTime, finishDateTime);
                        ret = { "speech": eventDate + "の" + eventStartTime + "から" + eventFinishTime + "まで" + eventSummary + "を追加します" };
                        res.json(ret);

                        //サーバ側で予定の内容を表示
                        console.log("予定タイトル：" + eventSummary);
                        console.log("予定日　　　：" + eventDate);
                        console.log("開始時間　　：" + eventStartTime);
                        console.log("終了時間　　：" + eventFinishTime);

                        eventSummary = null;
                        eventDate = null;
                        eventStartTime = null;
                        eventFinishTime = null;
                    }
                } else if (req.body.result.metadata.intentName == "予定を教えて") {//Dialogflowの「予定を教えて」インテントからのwebhook．ここでは指定された日程の予定を検索
                    listEvents(oauth2Client, startDate, function (eventList) {
                        var returnMessage;//返信メッセージ用変数
                        if (eventList.length == 0) {//予定がない場合
                            returnMessage = "予定は特にありません";
                        } else {//予定がある場合
                            for (var i = 0; i < eventList.length; i++) {
                                if (i == 0) {//最初の予定だけはそのまま格納
                                    returnMessage = eventList[i].summary;
                                } else {//二つ目以降の予定は「と〇〇」となるように格納
                                    returnMessage = returnMessage + " と " + eventList[i].summary;
                                }
                            }
                        }
                        console.log(returnMessage);//サーバ側で返信メッセージを表示
                        ret = { "speech": returnMessage + "です" };
                        res.json(ret);
                    });
                } else if (req.body.result.metadata.intentName == "雑談") {
                    console.log(req.body.result.parameters);
                    let utt = req.body.result.parameters.any;
                    lightTalk(utt);
                }
            }
        });
    }


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

    function lightTalk(utt) {
        if (utt.search(new RegExp("？")) != -1) {

            var options = {
                url: 'https://api.apigw.smt.docomo.ne.jp/knowledgeQA/v1/ask?q=' + utt + '&APIKEY=' + apiKey,
                json: true
            };

            request.get(options, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                    ret = { "speech": "知識Q&A" };
                    res.json(ret);
                } else {
                    console.log('error: ' + response.statusCode);
                }
            });

        } else {//ここで雑談対話apiを叩く
            if (talkContext == null) {
                var options = {
                    url: 'https://api.apigw.smt.docomo.ne.jp/dialogue/v1/dialogue?APIKEY=' + apiKey,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    json: {
                        "utt": utt
                    }
                }
            } else {
                var options = {
                    url: 'https://api.apigw.smt.docomo.ne.jp/dialogue/v1/dialogue?APIKEY=' + apiKey,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    json: {
                        "utt": utt,
                        "context": talkContext,
                    }
                }
            }
            //リクエスト送信
            request(options, function (error, response, body) {
                console.log(body);
                //コールバックで色々な処理
                talkContext = body.talkContext;
                ret = { "speech": body.utt };
                res.json(ret);
            });
        }
    }
});



module.exports = router;
