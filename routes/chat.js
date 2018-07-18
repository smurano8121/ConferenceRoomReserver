/**
 * dialog flowからのwebhookを受け取って，ユーザとの対話を行う
 * googleカレンダ部分はgoogleApiAcessに移譲
 */

const express = require('express');
const router = express.Router();

const fs = require('fs');
const readline = require('readline');

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
    if (req.body.queryResult.intent.displayName == "会議室予約") {
        console.log(req.body.queryResult.intent.displayName);

        let date = req.body.queryResult.parameters.date.match(/\d{4}-\d{2}-\d{2}T/);    //「2018-07-18T17:00:00+09:00」の「2018-07-18T」部分の正規表現
        let startTimeRegExr = req.body.queryResult.parameters.time[0].match(/\d{2}:\d{2}:\d{2}\W\d{2}:\d{2}/);  //「2018-07-18T17:00:00+09:00」の「17:00:00+09:00」部分の正規表現
        let finishTimeRegExr = req.body.queryResult.parameters.time[1].match(/\d{2}:\d{2}:\d{2}\W\d{2}:\d{2}/); //「2018-07-18T17:00:00+09:00」の「17:00:00+09:00」部分の正規表現

        slot.startDateTime = date+startTimeRegExr;
        slot.finishDateTime = date+finishTimeRegExr;
        slot.date = req.body.queryResult.parameters.date;
        slot.room = req.body.queryResult.parameters.confernceRoom;

        console.log(slot.startDateTime);
        console.log(slot.finishDateTime);

        attendees.push({'email': slot.room });//会議参加者としてリソースである会議室のリソースアドレスを格納
        

        let eventDate = new Date(slot.date);
        registData.year = eventDate.getFullYear();
        registData.month = eventDate.getMonth()+1;
        registData.date = eventDate.getDate();

        let startTime = new Date(slot.startDateTime);
        registData.startDateTime = slot.startDateTime;
        registData.startHours = startTime.getHours()+9; //修正必須（new Dateすると絶対にUTC標準時刻になってしまう）
        registData.startMinutes = startTime.getMinutes();
        registData.startSeconds = startTime.getSeconds();

        let finishTime = new Date(slot.finishDateTime);
        registData.finishDateTime = slot.finishDateTime;
        registData.finishHours = finishTime.getHours()+9; //修正必須
        registData.finishMinutes = finishTime.getMinutes();
        registData.finishSeconds = finishTime.getSeconds();

        registData.room = req.body.queryResult.parameters.confernceRoom;
        registData.attendees = attendees;

        console.log("予約日: " + registData.year + "年" + registData.month + "月" + registData.date + "日");
        console.log("開始時刻: " + registData.startHours + "時" + registData.startMinutes + "分");
        console.log("終了時刻: " + registData.finishHours + "時" + registData.finishMinutes + "分");

        fs.readFile('client_secret.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            console.log(registData);
            googleCalenderEventControler.authorizeInsertEvents(JSON.parse(content), registData,googleCalenderEventControler.insertEvents);
        });
        
        Room.find({ "address": slot.room }, function (err, result) {
            if (err) throw err;
            res.json({ "fulfillmentText": registData.month+"月"+registData.date+"日の"+registData.startHours+"時"+registData.startMinutes+"分から"+registData.finishHours+"時"+registData.finishMinutes+"分まで"+result[0].name+"を予約します" });
        });
    }
    else if (req.body.queryResult.intent.displayName == "参加者") {
        console.log("参加者");
        let attendeesListFromDialogFlow = req.body.queryResult.parameters.userName;
        var responseName = '';
        attendees = [];
        
        attendeesListFromDialogFlow.forEach(attendeeMail => {
            User.find({"email": attendeeMail},function(err,result){
                responseName = result[0].name+"さん";
                console.log(responseName);
                var addData = { 'email' : attendeeMail };
                attendees.push(addData) ;
            });
        });
        res.json({ "fulfillmentText": "参加者は"+responseName+"ですね？合っていれば予約日時と場所を教えてください"});
    }
});



module.exports = router;