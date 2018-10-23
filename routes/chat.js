/**
 * dialog flowからのwebhookを受け取って，ユーザとの対話を行う
 * googleカレンダ部分はgoogleApiAcessに移譲
 */

const express = require('express');
const router = express.Router();

const fs = require('fs');
const readline = require('readline');

const { google } = require('googleapis');
require('date-utils');

//データモデル
const User = require('../models/user');
const Room = require('../models/room');

//外部ファイルからカレンダAPIアクセス用の関数を取得
const googleCalenderEventControler = require('../public/javascripts/server/googleCalenderAccess');

let gDate;

let registData = {
    summary: null,
    date: null,
    startTime: null,
    endTime: null,
    attendees: null,
    room: null
}

var attendees; //会議参加者格納Object

/* POST home page. */
router.post('/webhook', function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    if (req.body.queryResult.intent.displayName == "ReserveFromAllParameter") {
        console.log(req.body.queryResult.intent.displayName);
        if(!req.body.queryResult.allRequiredParamsPresent){
            res.json({ "fulfillmentText": req.body.queryResult.fulfillmentText });
        }else{
            registData.room = req.body.queryResult.parameters.conferenceRoom; //予約する会議室のリソースIDを登録用データに格納

            //予約日
            let dDate = new Date(req.body.queryResult.parameters.date);
            gDate = new Date(req.body.queryResult.parameters.date); //グローバル変数として用いるdate変数
            date = dDate;
            let reserveDate = dDate.toFormat('YYYY年MM月DD日');


            //予約開始時間
            let startTime = new Date(req.body.queryResult.parameters.startTime);
            dDate.setHours(startTime.getHours());
            dDate.setMinutes(startTime.getMinutes());
            registData.startTime = new Date(dDate); //予定登録に使用するのはUTC
            dDate.setHours(startTime.getHours() + 9); //to JST
            let reserveStartTime = dDate.toFormat('HH24時MI分');

            //利用時間
            let useTimeAmount = req.body.queryResult.parameters.duration.amount;
            let useTimeUnit   = req.body.queryResult.parameters.duration.unit;

            //予約終了時間
            let endTime = dDate;

            switch (useTimeUnit) { //@sys.durationのunitに応じて処理をわける。日は無視して時と分のみだけの対応にしておく
                case '時':
                  endTime.setHours(dDate.getHours() + Number(useTimeAmount));
                  break;
                case '分':
                  endTime.setMinutes(dDate.getMinutes() + Number(useTimeAmount));
                  break;
                default:  
                  endTime.setHours(dDate.getHours() + Number(useTimeAmount));
                  break;
            }
            let reserveEndTime = endTime.toFormat('HH24時MI分');
            registData.endTime = new Date(endTime.setHours(endTime.getHours() - 9));

            //会議場所の登録
            attendees = [];
            attendees.push({'email': registData.room }); //会議室もゲスト招待するのでattendeesに追加
            registData.attendees = attendees //登録用データにattendeesを格納
        
            console.log("予約日："+reserveDate);
            console.log("開始時間："+reserveStartTime);
            console.log("終了時間："+reserveEndTime);

            let attendeesListFromDialogFlow = req.body.queryResult.parameters.userName;
            var responseName = '';
            let counter = 0;
            
            
            // DialogFlowから送られてくるのはユーザのメールアドレスなので，メールアドレスをキーにDBからユーザ名を掘りだす
            attendeesListFromDialogFlow.forEach(attendeeMail => {
                User.find({"email": attendeeMail},function(err,result){
                    counter += 1;
                    responseName += result[0].name+"さん";
                    console.log(responseName);
                    var addData = { 'email' : attendeeMail };
                    attendees.push(addData) ;
                    if(counter == attendeesListFromDialogFlow.length){
                        registData.summary = "ミーティング" + "【" + result[0].name+ "】";
                    }
                });
            });

            fs.readFile('client_secret.json', (err, content) => {
                if (err) return console.log('Error loading client secret file:', err);
                googleCalenderEventControler.authorizeInsertEvents(
                    JSON.parse(content), 
                    registData, 
                    checkFreeBusy
                );
            });
        }
    }
   
    else if (req.body.queryResult.intent.displayName == "Final_Confirm") {
        fs.readFile('client_secret.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            googleCalenderEventControler.authorizeInsertEvents(JSON.parse(content), registData, googleCalenderEventControler.insertEvents);
        });
        res.json({ "fulfillmentText": "承知致しました．指定いただいた参加者および日程で予約します．"});
    }
    
    function checkFreeBusy(auth,registData){
        var calendar = google.calendar('v3');

        var start = registData.startTime;
        var endTime = registData.endTime;
        var searchFreeBusyLimit = new Date(gDate);
        searchFreeBusyLimit.setHours(21,0,0)
        var responseStartTime = start
        var responseEndTime = endTime
        
        calendar.freebusy.query({
            auth: auth,
            headers: { "content-type" : "application/json" },
            resource: {
                items: [
                    {id : registData.room}
                ], 
                timeMin: registData.startTime,
                timeMax: searchFreeBusyLimit,
                "timeZone": 'Asia/Tokyo'
            } 
        },function(err,response){
            if (err) {
                    console.log("エラー");
                    console.log('There was an error contacting the Calendar service: ' + err);
                    return;
            }
            console.log("timeMin: " + registData.startTime)
            console.log("timeMax: " + searchFreeBusyLimit)
            
            var busy = response.data.calendars[registData.room].busy.filter(function(item, index){
                if (item.end != null) {
                    console.log(JSON.stringify(item));
                    return true;
                }
              });
            
            var events = response.data.calendars[registData.room].busy;
            responseStartTime.setHours(registData.startTime.getHours()+9);
            responseEndTime.setHours(endTime.getHours()+9);
            
            
            if (events.length == 0) {
                console.log('free in here...');
                Room.find({ "address": registData.room }, function (err, result) {
                    if (err) throw err;
                    res.json({ "fulfillmentText": date.toFormat('YYYY年MM月DD日')+"の"+responseStartTime.toFormat('HH24時MI分')+"から"+responseEndTime.toFormat('HH24時MI分')+"まで"+result[0].name+"でよろしいですか？" });
                });
            } else {
                var resStart = new Date(busy[0].start);
                resStart.setHours(resStart.getHours()+9)
                console.log(busy[0].end)
                var resEnd = new Date(busy[0].end);
                resEnd.setHours(resEnd.getHours()+9)

            
                if(resStart > registData.startTime && resEnd > registData.endTime){
                    console.log('free in here...');
                    Room.find({ "address": registData.room }, function (err, result) {
                        if (err) throw err;
                        res.json({ "fulfillmentText": date.toFormat('YYYY年MM月DD日')+"の"+responseStartTime.toFormat('HH24時MI分')+"から"+responseEndTime.toFormat('HH24時MI分')+"まで"+result[0].name+"でよろしいですか？" });
                    });
                }else if(registData.startTime < resStart){
                    var canReserveTime = new Date(resStart)
                    res.json({ "fulfillmentText": canReserveTime.toFormat('HH24時MI分')+"までであれば予約可能です．この時間までを予約しますか？" });
                    registData.endTime = resStart;
                }else {
                    console.log('busy in here...');
                    var canReserveTime = new Date(resEnd)
                    res.json({ "fulfillmentText": date.toFormat('YYYY年MM月DD日')+"の"+responseStartTime.toFormat('HH24時MI分')+"から"+canReserveTime.toFormat('HH24時MI分')+"はすでに予約されています．"+canReserveTime.toFormat('HH24時MI分')+"からであれば予約できます．予約しますか？" });
                    registData.startTime = resEnd;

                    switch (useTimeUnit) { //@sys.durationのunitに応じて処理をわける。日は無視して時と分のみだけの対応にしておく
                        case '時':
                        registData.endTime.setHours(resEnd.getHours() + Number(useTimeAmount));
                          break;
                        case '分':
                        registData.endTime.setMinutes(resEnd.getMinutes() + Number(useTimeAmount));
                          break;
                        default:  
                        registData.endTime.setHours(resEnd.getHours() + Number(useTimeAmount));
                          break;
                    }
                }
            }   
        });
    }
});
module.exports = router;
