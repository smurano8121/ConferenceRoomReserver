/**
 * dialog flowからのwebhookを受け取って，ユーザとの対話を行う
 * googleカレンダ部分はgoogleApiAcessに移譲
 */

const express = require('express');
const router = express.Router();

const fs = require('fs');
const readline = require('readline');

const { google } = require('googleapis');

//データモデル
const User = require('../models/user');
const Room = require('../models/room');

//外部ファイルからカレンダAPIアクセス用の関数を取得
const googleCalenderEventControler = require('../public/javascripts/server/googleCalenderAccess');

let slot = {
    name: null,
    date: null,
    startDateTime: null,
    finishDateTime: null,
    eventSummary: null,
    room: null,
}

let registData = {
    summary: null,
    year: null,
    month: null,
    date: null,
    startDateTime: null,
    startHours: null,
    startMinutes: null,
    startSeconds: null,
    finishDateTime: null,
    finishHours: null,
    finishMinutes: null,
    finishSeconds: null,
    attendees: null,
    room: null
}

var attendees; //会議参加者格納Object

/* POST home page. */
router.post('/webhook', function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    if (req.body.queryResult.intent.displayName == "ReserveFromStartEnd") {
        console.log(req.body.queryResult.intent.displayName);
        if(!req.body.queryResult.allRequiredParamsPresent){
            res.json({ "fulfillmentText": req.body.queryResult.fulfillmentText });
        }else{
            let date = req.body.queryResult.parameters.date.match(/\d{4}-\d{2}-\d{2}T/);    //「2018-07-18T17:00:00+09:00」の「2018-07-18T」部分の正規表現
            let startTimeRegExr = req.body.queryResult.parameters['time-period'].startTime.match(/\d{2}:\d{2}:\d{2}\W\d{2}:\d{2}/);  //「2018-07-18T17:00:00+09:00」の「17:00:00+09:00」部分の正規表現
            let finishTimeRegExr = req.body.queryResult.parameters['time-period'].endTime.match(/\d{2}:\d{2}:\d{2}\W\d{2}:\d{2}/); //「2018-07-18T17:00:00+09:00」の「17:00:00+09:00」部分の正規表現

            slot.startDateTime = date + startTimeRegExr;
            slot.finishDateTime = date + finishTimeRegExr;
            slot.date = req.body.queryResult.parameters.date;
            slot.room = req.body.queryResult.parameters.confernceRoom;

            attendees.push({'email': slot.room });//会議参加者としてリソースである会議室のリソースアドレスを格納
            
            let eventDate = new Date(slot.date);
            registData.year = eventDate.getFullYear();
            registData.month = eventDate.getMonth()+1;
            registData.date = eventDate.getDate();

            let startTime = new Date(slot.startDateTime);
            registData.startDateTime = slot.startDateTime;
            registData.startHours = startTime.getHours() + 9; //修正必須（new Dateすると絶対にUTC標準時刻になってしまう）
            registData.startMinutes = startTime.getMinutes();
            registData.startSeconds = startTime.getSeconds();

            let finishTime = new Date(slot.finishDateTime);
            registData.finishDateTime = slot.finishDateTime;
            registData.finishHours = finishTime.getHours() + 9; //修正必須
            registData.finishMinutes = finishTime.getMinutes();
            registData.finishSeconds = finishTime.getSeconds();

            registData.room = req.body.queryResult.parameters.confernceRoom;
            registData.attendees = attendees;

            console.log("予約日: " + registData.year + "年" + registData.month + "月" + registData.date + "日");
            console.log("開始時刻: " + registData.startHours + "時" + registData.startMinutes + "分");
            console.log("終了時刻: " + registData.finishHours + "時" + registData.finishMinutes + "分");

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
    else if (req.body.queryResult.intent.displayName == "ReserveFromStartOnly") {
        console.log(req.body.queryResult.intent.displayName);
        if(!req.body.queryResult.allRequiredParamsPresent){
            res.json({ "fulfillmentText": req.body.queryResult.fulfillmentText });
        }else{
            let nowDate = new Date();
            let dateMilsec = new Date(req.body.queryResult.parameters.date).getTime() - 1000 * 60 * 60 * 12;
            let startDateMilsec = new Date(req.body.queryResult.parameters.startTime).getTime();
            let timePeriod = new Date(req.body.queryResult.parameters.time_hour);
            let timeDiff = timePeriod - nowDate;
            let dateDiff = dateMilsec - nowDate.getTime();
            let finishDateMilsec = startDateMilsec + timeDiff;

            slot.date = req.body.queryResult.parameters.date;
            slot.room = req.body.queryResult.parameters.confernceRoom;

            attendees.push({'email': slot.room });//会議参加者としてリソースである会議室のリソースアドレスを格納

            let eventDate = new Date(slot.date);
            registData.year = eventDate.getFullYear();
            registData.month = eventDate.getMonth()+1;
            registData.date = eventDate.getDate();

            let startTime = new Date(startDateMilsec);
            registData.startDateTime = new Date(dateDiff + startDateMilsec);
            registData.startHours = startTime.getHours() + 9; //修正必須（new Dateすると絶対にUTC標準時刻になってしまう）
            registData.startMinutes = startTime.getMinutes();
            registData.startSeconds = startTime.getSeconds();

            let finishTime = new Date(finishDateMilsec + 1000 * 60);
            registData.finishDateTime = new Date(dateDiff + finishDateMilsec + 1000 * 60);
            registData.finishHours = finishTime.getHours() + 9; //修正必須
            registData.finishMinutes = finishTime.getMinutes();
            registData.finishSeconds = finishTime.getSeconds();

            registData.room = req.body.queryResult.parameters.confernceRoom;
            registData.attendees = attendees;

            console.log("予約日: " + registData.year + "年" + registData.month + "月" + registData.date + "日");
            console.log("開始時刻: " + registData.startHours + "時" + registData.startMinutes + "分");
            console.log("終了時刻: " + registData.finishHours + "時" + registData.finishMinutes + "分");

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
        var test = {test:[
            {id : registData.room},
            {id : registData.attendees[0].email},
            {id : registData.attendees[1].email}
        ]}
        console.log(registData.room);
        console.log(registData.attendees[0].email);
        console.log(registData.startDateTime);
        console.log(registData.finishDateTime);
        calendar.freebusy.query({
            auth: auth,
            headers: { "content-type" : "application/json" },
            resource: {
                items: test.test, 
                timeMin: registData.startDateTime,
                timeMax: registData.finishDateTime,
                "timeZone": 'Asia/Tokyo'
            } 
        },function(err,response){
            if (err) {
                    console.log("エラー");
                    console.log('There was an error contacting the Calendar service: ' + err);
                    return;
            }   
            // var events = response.data.calendars[registData.attendees[0].email].busy;

            for(var attendeeId = 0; attendeeId < registData.attendees.length; attendeeId++){
                var events = response.data.calendars[registData.attendees[attendeeId].email].busy;
                if (events.length == 0) {
                    console.log('free in here...');
                    if(registData.attendees[attendeeId].email != slot.room) continue;
                    Room.find({ "address": slot.room }, function (err, result) {
                        // if (err) ;
                        res.json({ "fulfillmentText": registData.month+"月"+registData.date+"日の"+registData.startHours+"時"+registData.startMinutes+"分から"+registData.finishHours+"時"+registData.finishMinutes+"分まで"+result[0].name+"でよろしいですか？" });
                    });
                } else {
                    console.log('busy in here...');
                    res.json({ "fulfillmentText": registData.month+"月"+registData.date+"日の"+registData.startHours+"時"+registData.startMinutes+"分から"+registData.finishHours+"時"+registData.finishMinutes+"分はすでに予約されています．別の時間帯もしくは別の会議室を予約してください" });
                    break;
                } 
            }

            // registData.attendees.forEach(attendee =>{
            //     console.log(attendee.email);
            //     var events = response.data.calendars[attendee.email].busy;
            //     if (events.length == 0) {
            //         console.log('free in here...');
            //         Room.find({ "address": slot.room }, function (err, result) {
            //             if (err) return;
            //             res.json({ "fulfillmentText": registData.month+"月"+registData.date+"日の"+registData.startHours+"時"+registData.startMinutes+"分から"+registData.finishHours+"時"+registData.finishMinutes+"分まで"+result[0].name+"でよろしいですか？" });
            //         });
            //     } else {
            //         console.log('busy in here...');
            //         res.json({ "fulfillmentText": registData.month+"月"+registData.date+"日の"+registData.startHours+"時"+registData.startMinutes+"分から"+registData.finishHours+"時"+registData.finishMinutes+"分はすでに予約されています．別の時間帯もしくは別の会議室を予約してください" });
            //         // break;
            //     }   
            // });
            // var events = response.data.calendars[registData.room].busy;
            // if (events.length == 0) {
            //     console.log('free in here...');
            //     Room.find({ "address": slot.room }, function (err, result) {
            //         if (err) throw err;
            //         res.json({ "fulfillmentText": registData.month+"月"+registData.date+"日の"+registData.startHours+"時"+registData.startMinutes+"分から"+registData.finishHours+"時"+registData.finishMinutes+"分まで"+result[0].name+"でよろしいですか？" });
            //     });
            // } else {
            //     console.log('busy in here...');
            //     res.json({ "fulfillmentText": "その時間はすでに予約されています．別の時間帯もしくは別の会議室を予約してください" });
            // }   
        });
    }
});
module.exports = router;
