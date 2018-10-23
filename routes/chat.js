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

let dDate;

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
    if (req.body.queryResult.intent.displayName == "ReserveFromStartEnd") {
        // console.log(req.body.queryResult.intent.displayName);
        // if(!req.body.queryResult.allRequiredParamsPresent){
        //     res.json({ "fulfillmentText": req.body.queryResult.fulfillmentText });
        // }else{
        //     let date = req.body.queryResult.parameters.date.match(/\d{4}-\d{2}-\d{2}T/);    //「2018-07-18T17:00:00+09:00」の「2018-07-18T」部分の正規表現
        //     let startTimeRegExr = req.body.queryResult.parameters['time-period'].startTime.match(/\d{2}:\d{2}:\d{2}\W\d{2}:\d{2}/);  //「2018-07-18T17:00:00+09:00」の「17:00:00+09:00」部分の正規表現
        //     let finishTimeRegExr = req.body.queryResult.parameters['time-period'].endTime.match(/\d{2}:\d{2}:\d{2}\W\d{2}:\d{2}/); //「2018-07-18T17:00:00+09:00」の「17:00:00+09:00」部分の正規表現

        //     slot.startDateTime = date + startTimeRegExr;
        //     slot.finishDateTime = date + finishTimeRegExr;
        //     slot.date = req.body.queryResult.parameters.date;
        //     slot.room = req.body.queryResult.parameters.confernceRoom;

        //     attendees.push({'email': slot.room });//会議参加者としてリソースである会議室のリソースアドレスを格納
            
        //     let eventDate = new Date(slot.date);
        //     registData.year = eventDate.getFullYear();
        //     registData.month = eventDate.getMonth()+1;
        //     registData.date = eventDate.getDate();

        //     let startTime = new Date(slot.startDateTime);
        //     registData.startDateTime = slot.startDateTime;
        //     registData.startHours = startTime.getHours() + 9; //修正必須（new Dateすると絶対にUTC標準時刻になってしまう）
        //     registData.startMinutes = startTime.getMinutes();
        //     registData.startSeconds = startTime.getSeconds();

        //     let finishTime = new Date(slot.finishDateTime);
        //     registData.finishDateTime = slot.finishDateTime;
        //     registData.finishHours = finishTime.getHours() + 9; //修正必須
        //     registData.finishMinutes = finishTime.getMinutes();
        //     registData.finishSeconds = finishTime.getSeconds();

        //     registData.room = req.body.queryResult.parameters.confernceRoom;
        //     registData.attendees = attendees;

        //     console.log("予約日: " + registData.year + "年" + registData.month + "月" + registData.date + "日");
        //     console.log("開始時刻: " + registData.startHours + "時" + registData.startMinutes + "分");
        //     console.log("終了時刻: " + registData.finishHours + "時" + registData.finishMinutes + "分");

        //     fs.readFile('client_secret.json', (err, content) => {
        //         if (err) return console.log('Error loading client secret file:', err);
        //         googleCalenderEventControler.authorizeInsertEvents(
        //             JSON.parse(content), 
        //             registData, 
        //             checkFreeBusy
        //         );
        //     });
        // }
    }
    else if (req.body.queryResult.intent.displayName == "ReserveFromAllParameter") {
        console.log(req.body.queryResult.intent.displayName);
        if(!req.body.queryResult.allRequiredParamsPresent){
            res.json({ "fulfillmentText": req.body.queryResult.fulfillmentText });
        }else{
            registData.room = req.body.queryResult.parameters.conferenceRoom;
            //予約日
            dDate = new Date(req.body.queryResult.parameters.date);
            date = dDate;
            let reserveDate = dDate.toFormat('YYYY年MM月DD日');


            //予約開始時間
            let startTime = new Date(req.body.queryResult.parameters.startTime);
            dDate.setHours(startTime.getHours());
            dDate.setMinutes(startTime.getMinutes());
            registData.startTime = new Date(dDate);
            dDate.setHours(startTime.getHours() + 9); //to JST
            let reserveStartTime = dDate.toFormat('HH24時MI分');

            //利用時間
            let useTimeAmount = req.body.queryResult.parameters.duration.amount;
            let useTimeUnit   = req.body.queryResult.parameters.duration.unit;
            let useTime = useTimeAmount + useTimeUnit;
            console.log(req.body.queryResult.parameters.duration);

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
            attendees.push({'email': registData.room });
            registData.attendees = attendees
        
            console.log("予約日："+reserveDate);
            console.log("開始時間："+reserveStartTime);
            console.log("終了時間："+reserveEndTime);

            let attendeesListFromDialogFlow = req.body.queryResult.parameters.userName;
            var responseName = '';
            let counter = 0;
            
            
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
    else if (req.body.queryResult.intent.displayName == "Atendee") {
        console.log("参加者");
        if(!req.body.queryResult.allRequiredParamsPresent){
            res.json({ "fulfillmentText": req.body.queryResult.fulfillmentText });
        }else{
            let attendeesListFromDialogFlow = req.body.queryResult.parameters.userName;
            var responseName = '';
            let counter = 0;
            attendees = [];
            
            attendeesListFromDialogFlow.forEach(attendeeMail => {
                User.find({"email": attendeeMail},function(err,result){
                    counter += 1;
                    responseName += result[0].name+"さん";
                    console.log(responseName);
                    var addData = { 'email' : attendeeMail };
                    attendees.push(addData) ;
                    if(counter == attendeesListFromDialogFlow.length){
                        registData.summary = "ミーティング" + "【" + result[0].name+ "】";
                        res.json({ "fulfillmentText": "参加者は"+responseName+"ですね？合っていれば予約日時と場所を教えてください．間違っていればもう一度お願いします"});
                    }
                });
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

        var startTime = registData.startTime;
        var endTime = registData.endTime;
        var searchFreeBusyLimit = new Date(dDate);
        searchFreeBusyLimit.setHours(21,0,0)
        var responseStartTime = startTime
        var responseEndTime = endTime
        // responseStartTime.setHours(startTime.getHours()+9);
        // responseEndTime.setHours(endTime.getHours()+9);
        // startTimeJP.setHours(registData.startTime.getHours()+9);
        // endTimeJP.setHours(registData.endTime.getHours()+9);
        
        

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
            // console.log("timeMax: " + end) 
            console.log(JSON.stringify(response.data.calendars[registData.room].busy[0].end))
            var busy = response.data.calendars[registData.room].busy.filter(function(item, index){
                if (item.end != null) return true;
              });
            console.log("部屋の状況だよ：" + response.data.calendars[registData.room].busy[0].end)
            console.log("endの中身だよ"+busy[0].end)
            var events = response.data.calendars[registData.room].busy;
            responseStartTime.setHours(startTime.getHours()+9);
            responseEndTime.setHours(endTime.getHours()+9);
            

            if (events.length == 0) {
                console.log('free in here...');
                Room.find({ "address": registData.room }, function (err, result) {
                    if (err) throw err;
                    res.json({ "fulfillmentText": date.toFormat('YYYY年MM月DD日')+"の"+responseStartTime.toFormat('HH24時MI分')+"から"+responseEndTime.toFormat('HH24時MI分')+"まで"+result[0].name+"でよろしいですか？" });
                });
            } else {
                console.log('busy in here...');
                var resEnd = new Date(busy[0].end);
                // responseEndTime.setHours(resEnd.getHours()+9)
                res.json({ "fulfillmentText": date.toFormat('YYYY年MM月DD日')+"の"+responseStartTime.toFormat('HH24時MI分')+"から"+responseEndTime.toFormat('HH24時MI分')+"はすでに予約されています．別の時間帯もしくは別の会議室を予約してください" });
            }   
        });
    }
});
module.exports = router;
