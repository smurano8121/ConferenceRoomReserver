/**
 * dialog flowからのwebhookを受け取って，ユーザとの対話を行う
 * googleカレンダ部分はgoogleApiAcessに移譲
 */

const express = require("express");
const router = express.Router();

const fs = require("fs");
const readline = require("readline");

const { google } = require("googleapis");
require("date-utils");
const moment = require("moment");

//データモデル
const User = require("../models/user");
const Room = require("../models/room");

//外部ファイルからカレンダAPIアクセス用の関数を取得
const googleCalenderEventControler = require("../public/javascripts/server/googleCalenderAccess");
let gDate;

let registData = {
    summary: null,
    date: null,
    startTime: null,
    endTime: null,
    attendees: null,
    attendeesForFreeBusy,
    room: null
};

let rooms = new Array(); //会議室カレンダー登録用
rooms.push({
    email:
        "mikilab.doshisha.ac.jp_3235333239333534343633@resource.calendar.google.com"
});
rooms.push({
    email:
        "mikilab.doshisha.ac.jp_2d3837393537303637353132@resource.calendar.google.com"
});
rooms.push({
    email:
        "mikilab.doshisha.ac.jp_33353234353936362d333132@resource.calendar.google.com"
});

let IDrooms = new Array(); //会議室の空き検索用
IDrooms.push(
    "mikilab.doshisha.ac.jp_3235333239333534343633@resource.calendar.google.com"
);
IDrooms.push(
    "mikilab.doshisha.ac.jp_2d3837393537303637353132@resource.calendar.google.com"
);
IDrooms.push(
    "mikilab.doshisha.ac.jp_33353234353936362d333132@resource.calendar.google.com"
);

var attendees; //会議参加者格納Object {emai: hogehoge@mikilab.doshisha.ac.jp}
var attendeesForFreeBusy; //freebusyで予定が入ってるかチェックする時に使うObject{id: hogehoge@mikilab.doshisha.ac.jp}

/* POST home page. */
router.post("/webhook", function(req, res, next) {
    res.header("Content-Type", "application/json;charset=utf-8");
    // res.setHeader("Content-Type", "application/json");
    if (req.body.queryResult.intent.displayName == "ReserveFromAllParameter") {
        console.log(req.body.queryResult.intent.displayName);
        if (!req.body.queryResult.allRequiredParamsPresent) {
            res.json({ fulfillmentText: req.body.queryResult.fulfillmentText });
        } else {
            registData.room = req.body.queryResult.parameters.conferenceRoom; //予約する会議室のリソースIDを登録用データに格納

            //予約日
            let dDate = new Date(req.body.queryResult.parameters.date);
            gDate = new Date(req.body.queryResult.parameters.date); //グローバル変数として用いるdate変数
            date = dDate;
            let reserveDate = dDate.toFormat("YYYY年MM月DD日");

            //予約開始時間
            let startTime = new Date(req.body.queryResult.parameters.startTime);
            dDate.setHours(startTime.getHours());
            dDate.setMinutes(startTime.getMinutes());
            registData.startTime = new Date(dDate); //予定登録に使用するのはUTC
            dDate.setHours(startTime.getHours() + 9); //to JST
            let reserveStartTime = dDate.toFormat("HH24時MI分");

            //利用時間
            let useTimeAmount = req.body.queryResult.parameters.duration.amount;
            let useTimeUnit = req.body.queryResult.parameters.duration.unit;

            //予約終了時間
            let endTime = dDate;

            switch (
                useTimeUnit //@sys.durationのunitに応じて処理をわける。日は無視して時と分のみだけの対応にしておく
            ) {
                case "時":
                    endTime.setHours(dDate.getHours() + Number(useTimeAmount));
                    break;
                case "分":
                    endTime.setMinutes(
                        dDate.getMinutes() + Number(useTimeAmount)
                    );
                    break;
                default:
                    endTime.setHours(dDate.getHours() + Number(useTimeAmount));
                    break;
            }
            let reserveEndTime = endTime.toFormat("HH24時MI分");
            registData.endTime = new Date(
                endTime.setHours(endTime.getHours() - 9)
            );

            //会議場所の登録
            attendees = [];
            attendeesForFreeBusy = [];
            attendees.push({ email: registData.room }); //会議室もゲスト招待するのでattendeesに追加
            attendeesForFreeBusy.push({ id: registData.room }); //会議室もゲスト招待するのでattendeesに追加
            registData.attendees = attendees; //登録用データにattendeesを格納
            registData.attendeesForFreeBusy = attendeesForFreeBusy;

            console.log("予約日：" + reserveDate);
            console.log("開始時間：" + reserveStartTime);
            console.log("終了時間：" + reserveEndTime);

            let attendeesListFromDialogFlow =
                req.body.queryResult.parameters.userName;
            var responseName = "";
            let counter = 0;

            // DialogFlowから送られてくるのはユーザのメールアドレスなので，メールアドレスをキーにDBからユーザ名を掘りだす
            attendeesListFromDialogFlow.forEach(attendeeMail => {
                User.find({ email: attendeeMail }, function(err, result) {
                    counter += 1;
                    responseName += result[0].name + "さん";
                    console.log(responseName);
                    var addData = { email: attendeeMail };
                    var addDataForFreeBusy = { id: attendeeMail };
                    attendees.push(addData);
                    attendeesForFreeBusy.push(addDataForFreeBusy);
                    if (counter == attendeesListFromDialogFlow.length) {
                        registData.summary =
                            "ミーティング" + "【" + result[0].name + "】";
                    }
                });
            });

            fs.readFile("client_secret.json", (err, content) => {
                if (err)
                    return console.log(
                        "Error loading client secret file:",
                        err
                    );
                googleCalenderEventControler.authorizeInsertEvents(
                    JSON.parse(content),
                    registData,
                    checkFreeBusy
                );
            });
        }
    } else if (req.body.queryResult.intent.displayName == "SearchFreeTime") {
        console.log(req.body.queryResult.intent.displayName);
        console.log("参加者：" + req.body.queryResult.parameters.userName);
        var startDateTimeBuff = new Date(
            req.body.queryResult.parameters.datePeriod.startDate
        );
        var endDateTimeBuff = new Date(
            req.body.queryResult.parameters.datePeriod.endDate
        );

        startDateTimeBuff.setHours(startDateTimeBuff.getHours() + 9 - 3); //JSTに変えてから12時を9時にするために-3時間
        endDateTimeBuff.setHours(endDateTimeBuff.getHours() + 9 + 8); //JSTに変えてから12時を20時にするために+8時間

        //add smurano//
        //startDateTimeBuffが現在よりも前の時間だった場合startDateBuffを現在の時間にする
        var startDateTime = startDateTimeBuff.toFormat("YYYYMMDDHH24MISS");
        var date = new Date();
        var currentTime = date.toFormat("YYYYMMDDHH24MISS");
        if(startDateTime < currentTime){
            var tomorrowDate = Date.tomorrow();
            tomorrowDate.setHours(tomorrowDate.getHours() - 3); //JSTに変えてから0時を9時にするために+9時間
            registData.startTime = tomorrowDate;
        }else{
            registData.startTime = startDateTimeBuff;
        }

        registData.endTime = endDateTimeBuff;

        console.log("スタート編集後：" + startDateTime);
        console.log("現在時刻：" + date);
        console.log("スタート：" + registData.startTime);
        console.log("エンド：" + endDateTimeBuff);

        //参加者の登録
        attendeesForFreeBusy = [];
        attendeesForFreeBusy.push({
            id: req.body.queryResult.parameters.userName
        });
        registData.attendeesForFreeBusy = attendeesForFreeBusy;
        console.log(registData.attendeesForFreeBusy);

        fs.readFile("client_secret.json", (err, content) => {
            if (err)
                return console.log("Error loading client secret file:", err);
            googleCalenderEventControler.authorizeInsertEvents(
                JSON.parse(content),
                registData,
                checkFreeBusyForRecommend
            );
        });
    } else if (req.body.queryResult.intent.displayName == "SearchFreeTimeYes") {
        console.log(req.body.queryResult);

        // fs.readFile("client_secret.json", (err, content) => {
        //     if (err)
        //         return console.log(
        //             "Error loading client secret file:",
        //             err
        //         );
        //     googleCalenderEventControler.authorizeInsertEvents(
        //         JSON.parse(content),
        //         registData,
        //         checkFreeBusy
        //     );
        // });
    } else if (req.body.queryResult.intent.displayName == "Final_Confirm") {
        fs.readFile("client_secret.json", (err, content) => {
            if (err)
                return console.log("Error loading client secret file:", err);
            googleCalenderEventControler.authorizeInsertEvents(
                JSON.parse(content),
                registData,
                googleCalenderEventControler.insertEvents
            );
        });
        res.json({
            fulfillmentText:
                "承知致しました．指定いただいた参加者および日程で予約します．"
        });
    } else if (req.body.queryResult.intent.displayName == "ConferenceSearch") {
        //予約日
        let dDate = new Date(req.body.queryResult.parameters.date);
        gDate = new Date(req.body.queryResult.parameters.date); //グローバル変数として用いるdate変数
        date = dDate;
        let reserveDate = dDate.toFormat("YYYY年MM月DD日");

        //予約開始時間
        let startTime = new Date(req.body.queryResult.parameters.startTime);
        dDate.setHours(startTime.getHours());
        dDate.setMinutes(startTime.getMinutes());
        registData.startTime = new Date(dDate); //予定登録に使用するのはUTC
        dDate.setHours(startTime.getHours() + 9); //to JST
        let reserveStartTime = dDate.toFormat("HH24時MI分");

        //利用時間
        let useTimeAmount = req.body.queryResult.parameters.duration.amount;
        let useTimeUnit = req.body.queryResult.parameters.duration.unit;
        //予約終了時間
        let endTime = dDate;

        switch (
            useTimeUnit //@sys.durationのunitに応じて処理をわける。日は無視して時と分のみだけの対応にしておく
        ) {
            case "時":
                endTime.setHours(dDate.getHours() + Number(useTimeAmount));
                break;
            case "分":
                endTime.setMinutes(dDate.getMinutes() + Number(useTimeAmount));
                break;
            default:
                endTime.setHours(dDate.getHours() + Number(useTimeAmount));
                break;
        }

        let reserveEndTime = endTime.toFormat("HH24時MI分");
        registData.endTime = new Date(endTime.setHours(endTime.getHours() - 9));
        registData.attendees = rooms; //登録用データにrooms（会議室）を格納
        console.log("予約日：" + reserveDate);
        console.log("開始時間：" + reserveStartTime);
        console.log("終了時間：" + reserveEndTime);

        fs.readFile("client_secret.json", (err, content) => {
            if (err)
                return console.log("Error loading client secret file:", err);
            googleCalenderEventControler.authorizeInsertEvents(
                JSON.parse(content),
                registData,
                checkFreeRoom
            );
        });
    }

    function checkFreeRoom(auth, registData) {
        var calendar = google.calendar("v3");
        var start = registData.startTime;
        var endTime = registData.endTime;
        var searchFreeBusyLimit = new Date(gDate);
        searchFreeBusyLimit.setHours(21, 0, 0);
        var responseStartTime = start;
        var responseEndTime = endTime;
        var freerooms = []; //空いてる会議室のデータ格納用
        var responsefreerooms = "";

        calendar.freebusy.query(
            {
                auth: auth,
                headers: { "content-type": "application/json; charset=utf-8" },
                resource: {
                    items: [
                        {
                            id:
                                "mikilab.doshisha.ac.jp_3235333239333534343633@resource.calendar.google.com"
                        },
                        {
                            id:
                                "mikilab.doshisha.ac.jp_2d3837393537303637353132@resource.calendar.google.com"
                        },
                        {
                            id:
                                "mikilab.doshisha.ac.jp_33353234353936362d333132@resource.calendar.google.com"
                        }
                    ],
                    timeMin: registData.startTime,
                    timeMax: registData.endTime,
                    timeZone: "Asia/Tokyo"
                }
            },
            function(err, response) {
                if (err) {
                    console.log("エラー");
                    console.log(
                        "There was an error contacting the Calendar service: " +
                            err
                    );
                    return;
                }
                console.log("timeMin: " + registData.startTime);
                console.log("timeMax: " + searchFreeBusyLimit);

                console.log(response.data);

                responseStartTime.setHours(registData.startTime.getHours() + 9);
                responseEndTime.setHours(endTime.getHours() + 9);
                for (var i = 0; i < IDrooms.length; i++) {
                    if (response.data.calendars[IDrooms[i]].busy.length == 0) {
                        console.log("きたよ");
                        freerooms.push(IDrooms[i]);
                    }
                }

                if (freerooms.length == 0) {
                    res.json({
                        fulfillmentText:
                            "その時間はどこの会議室も空いていません．"
                    });
                } else {
                    freerooms.forEach(function(roomAddress, index) {
                        Room.find({ address: roomAddress }, function(
                            err,
                            result
                        ) {
                            responsefreerooms += result[0].name + "\n";
                            console.log(responsefreerooms);
                            if (index == freerooms.length - 1) {
                                res.json({
                                    fulfillmentText:
                                        "その時間に空いている会議室は" +
                                        responsefreerooms +
                                        "です．"
                                });
                            }
                        });
                    });
                }
            }
        );
    }

    function checkFreeBusy(auth, registData) {
        var calendar = google.calendar("v3");

        var start = registData.startTime;
        var endTime = registData.endTime;
        var searchFreeBusyLimit = new Date(gDate);
        searchFreeBusyLimit.setHours(21, 0, 0);
        var responseStartTime = start;
        var responseEndTime = endTime;

        calendar.freebusy.query(
            {
                auth: auth,
                headers: { "content-type": "application/json; charset=UTF-8" },
                resource: {
                    items: registData.attendeesForFreeBusy,
                    timeMin: registData.startTime,
                    timeMax: searchFreeBusyLimit,
                    timeZone: "Asia/Tokyo"
                }
            },
            function(err, response) {
                if (err) {
                    console.log("エラー");
                    console.log(
                        "There was an error contacting the Calendar service: " +
                            err
                    );
                    return;
                }
                console.log("timeMin: " + registData.startTime);
                console.log("timeMax: " + searchFreeBusyLimit);

                var busy = response.data.calendars[registData.room].busy.filter(
                    function(item, index) {
                        if (item.end != null) {
                            console.log(JSON.stringify(item));
                            return true;
                        }
                    }
                );

                var events = response.data.calendars[registData.room].busy;
                console.log(JSON.stringify(response.data.calendars));
                responseStartTime.setHours(registData.startTime.getHours() + 9);
                responseEndTime.setHours(endTime.getHours() + 9);

                if (events.length == 0) {
                    console.log("free in here...");
                    Room.find({ address: registData.room }, function(
                        err,
                        result
                    ) {
                        if (err) throw err;
                        console.log(result);
                        res.json({
                            fulfillmentText:
                                date.toFormat("YYYY年MM月DD日") +
                                "の" +
                                responseStartTime.toFormat("HH24時MI分") +
                                "から" +
                                responseEndTime.toFormat("HH24時MI分") +
                                "まで" +
                                result[0].name +
                                "でよろしいですか？"
                        });
                    });
                } else {
                    var resStart = new Date(busy[0].start);
                    resStart.setHours(resStart.getHours() + 9);
                    console.log(busy[0].end);
                    var resEnd = new Date(busy[0].end);
                    resEnd.setHours(resEnd.getHours() + 9);

                    if (resStart > registData.endTime) {
                        console.log("free in here...");
                        Room.find({ address: registData.room }, function(
                            err,
                            result
                        ) {
                            if (err) throw err;
                            res.json({
                                fulfillmentText:
                                    date.toFormat("YYYY年MM月DD日") +
                                    "の" +
                                    responseStartTime.toFormat("HH24時MI分") +
                                    "から" +
                                    responseEndTime.toFormat("HH24時MI分") +
                                    "まで" +
                                    result[0].name +
                                    "でよろしいですか？"
                            });
                        });
                    } else if (registData.startTime < resStart) {
                        //開始時間には会議室は予約されていないが，終了時間までに予約がある場合
                        let canReserveTime = new Date(resStart);
                        let timeAmount =
                            req.body.queryResult.parameters.duration.amount;
                        let timeUnit =
                            req.body.queryResult.parameters.duration.unit;
                        switch (
                            timeUnit //@sys.durationのunitに応じて処理をわける。日は無視して時と分のみだけの対応にしておく
                        ) {
                            case "時":
                                registData.startTime.setHours(
                                    resStart.getHours() - Number(timeAmount)
                                );
                                registData.startTime.setMinutes(
                                    resStart.getMinutes()
                                );
                                break;
                            case "分":
                                registData.startTime.setHours(
                                    resStart.getHours()
                                );
                                registData.startTime.setMinutes(
                                    resStart.getMinutes() - Number(timeAmount)
                                );
                                break;
                            default:
                                registData.startTime.setHours(
                                    resStart.getHours() - Number(timeAmount)
                                );
                                break;
                        }
                        registData.endTime = resStart;

                        res.json({
                            fulfillmentText:
                                registData.startTime.toFormat("HH24時MI分") +
                                "から" +
                                canReserveTime.toFormat("HH24時MI分") +
                                "までであれば予約可能です．この時間までを予約しますか？"
                        });
                    } else {
                        //開始時間にすでに会議室が予約されている場合
                        console.log("busy in here...");
                        let canReserveTime = new Date(resEnd);
                        Room.find({ address: registData.room }, function(
                            err,
                            result
                        ) {
                            if (err) throw err;
                            res.json({
                                fulfillmentText:
                                    date.toFormat("YYYY年MM月DD日") +
                                    "の" +
                                    result[0].name +
                                    "は" +
                                    resStart.toFormat("HH24時MI分") +
                                    "から" +
                                    canReserveTime.toFormat("HH24時MI分") +
                                    "まですでに予約されています．" +
                                    canReserveTime.toFormat("HH24時MI分") +
                                    "からであれば予約できます．予約しますか？"
                            });
                        });
                        registData.startTime = resEnd;

                        let timeAmount =
                            req.body.queryResult.parameters.duration.amount;
                        let timeUnit =
                            req.body.queryResult.parameters.duration.unit;
                        switch (
                            timeUnit //@sys.durationのunitに応じて処理をわける。日は無視して時と分のみだけの対応にしておく
                        ) {
                            case "時":
                                registData.endTime.setHours(
                                    resEnd.getHours() + Number(timeAmount)
                                );
                                registData.endTime.setMinutes(
                                    resEnd.getMinutes()
                                );
                                break;
                            case "分":
                                registData.endTime.setHours(resEnd.getHours());
                                registData.endTime.setMinutes(
                                    resEnd.getMinutes() + Number(timeAmount)
                                );
                                break;
                            default:
                                registData.endTime.setHours(
                                    resEnd.getHours() + Number(timeAmount)
                                );
                                break;
                        }
                    }
                }
            }
        );
    }

    function checkFreeBusyForRecommend(auth, registData) {
        const calendar = google.calendar("v3");
        let timeAmount = req.body.queryResult.parameters.duration.amount;
        let timeUnit = req.body.queryResult.parameters.duration.unit;
        let alpha = 0;

        calendar.freebusy.query(
            {
                auth: auth,
                headers: { "content-type": "application/json; charset=utf-8" },
                resource: {
                    items: registData.attendeesForFreeBusy,
                    timeMin: registData.startTime,
                    timeMax: registData.endTime,
                    timeZone: "Asia/Tokyo"
                }
            },
            function(err, response) {
                if (err) {
                    console.log("エラー");
                    console.log(
                        "There was an error contacting the Calendar service: " +
                            err
                    );
                    return;
                }
                console.log("timeMin: " + registData.startTime);
                console.log("timeMax: " + registData.endTime);
                const calendarIds = response.data.groups[registData.attendeesForFreeBusy[0].id].calendars;
                const calendars = response.data.calendars;

                switch (
                    timeUnit //@sys.durationのunitに応じて処理をわける。日は無視して時と分のみだけの対応にしておく
                ) {
                    case "時":
                        alpha = timeAmount * 60 * 60;
                        break;
                    case "分":
                        alpha = timeAmount * 60;
                        break;
                    default:
                        alpha = timeAmount;
                        break;
                }
                makeUserBusyList(
                    alpha,
                    calendarIds,
                    calendars,
                    searchAllMemberFreeTime
                );
            }
        );
    }
    //alpha=会議時間，calendarIds=会議参加者，
    function makeUserBusyList(alpha, calendarIds, calendars, callback) {
        var userBusyList = [];
        console.log(alpha);
        calendarIds.forEach(calendarId => {
            console.log("Calendar ID：" + calendarId);
            const busyList = calendars[calendarId].busy; //各参加者のbusyリストを作成
            let counter = 0;
            let buffer = [];
            busyList.forEach(busy => {
                if (buffer.length == 0) {
                    buffer.push(busy);
                    counter = counter + 1;
                } else {
                    var milTimeDiff = Math.abs(
                        new moment(busy.start).unix() -
                            new moment(buffer[counter - 1].end).unix()
                    );
                    if (milTimeDiff < alpha) {
                        //差が1時間（3600000 msec）の場合＝会議希望時間より短い場合は結合する
                        buffer[counter - 1].end = busy.end;
                    } else {
                        //結合しない場合はそのままbufferにpush
                        buffer.push(busy);
                        counter = counter + 1;
                    }
                }
            });
            userBusyList.push(buffer);
        });
        callback(userBusyList, alpha, responseCommonFreeTime);
    }

    //全員の予定から全体のbusyListを作成している
    function searchAllMemberFreeTime(userBusyList, alpha, callback) {
        console.log(userBusyList); //ここにObject配列の形式で各人の予定が格納されている
        console.log(alpha); //結合するかを判断する時間（ms）
        let baseBusyList;

        userBusyList.forEach(function(comparisonBusyList, index) {
            console.log(index);
            if (index == 0) {
                baseBusyList = comparisonBusyList;
                //一人目の予定はbaseBusyListに格納
                console.log("一人目の予定ですよー")
                console.log(baseBusyList);
            } else {
                baseBusyList.forEach(function(baseBusy, index_baseBusyList) {
                    console.log("baseBusyですよー");
                    console.log(baseBusy);
                    baseBusyStart = moment(baseBusy.start);
                    baseBusyEnd = moment(baseBusy.end);
                    baseBusyStart.utcOffset("+0900");
                    baseBusyEnd.utcOffset("+0900");

                    comparisonBusyList.some(function(
                        comparisonBusy,
                        index_comparisonBusyList
                    ) {
                        comparisonBusyStart = moment(comparisonBusy.start);
                        comparisonBusyEnd = moment(comparisonBusy.end);
                        comparisonBusyStart.utcOffset("+0900");
                        comparisonBusyEnd.utcOffset("+0900");

                        console.log("baseStart      ：" + baseBusy.start);
                        console.log("baseEnd        ：" + baseBusy.end);
                        console.log("comparisonStart：" + comparisonBusy.start);
                        console.log("comparisonEnd  ：" + comparisonBusy.end);

                        if (
                            comparisonBusyStart.date() == baseBusyStart.date()
                        ) {
                            //日付が同じ場合
                            console.log("同じ日だよ");
                            comparisonBusyList.splice(
                                0,
                                index_comparisonBusyList
                            );
                            if (
                                baseBusyStart >= comparisonBusyEnd ||
                                baseBusyEnd <= comparisonBusyStart
                            ) {
                                if (
                                    new moment(baseBusyStart).unix() -
                                        new moment(comparisonBusyEnd).unix() <
                                        alpha &&
                                    0 <=
                                        new moment(baseBusyStart).unix() -
                                            new moment(comparisonBusyEnd).unix()
                                ) {
                                    console.log("パターン2,3");
                                    baseBusy.start = comparisonBusy.start;
                                } else if (
                                    new moment(comparisonBusyStart).unix() -
                                        new moment(baseBusyEnd).unix() <
                                        alpha &&
                                    0 <=
                                        new moment(comparisonBusyStart).unix() -
                                            new moment(baseBusyEnd).unix()
                                ) {
                                    console.log("パターン9,10");
                                    baseBusy.end = comparisonBusy.end;
                                } else {
                                    console.log("パターン1,11");
                                    baseBusyList.push(comparisonBusy);
                                }
                            } else if (baseBusyStart >= comparisonBusyStart) {
                                if (baseBusyEnd > comparisonBusyEnd) {
                                    console.log("パターン4,5");
                                    baseBusy.start = comparisonBusy.start;
                                } else {
                                    console.log("パターン12,13,14");
                                    baseBusy.start = comparisonBusy.start;
                                    baseBusy.end = comparisonBusy.end;
                                }
                            } else if (baseBusyStart < comparisonBusyStart) {
                                if (baseBusyEnd >= comparisonBusyEnd) {
                                    console.log("パターン6,7");
                                } else {
                                    console.log("パターン8");
                                    baseBusy.end = comparisonBusy.end;
                                    comparisonBusyList.splice(
                                        index_comparisonBusyList,
                                        1
                                    );
                                }
                            } else {
                                console.log("どのパターンにも当てはまらない");
                                baseBusyList.push(comparisonBusy);
                            }
                            // return true;
                        } else {
                            //日付が違った場合
                            console.log("同じ日じゃないよ〜");
                            baseBusyList.push(comparisonBusy);
                        }
                    });
                });
            }
        });

        //startの日時で昇順ソート
        baseBusyList.sort(function(item1, item2) {
            if (new moment(item1.start).unix() < new moment(item2.start).unix())
                return -1;
            if (new moment(item1.start).unix() > new moment(item2.start).unix())
                return 1;
            return 0;
        });

        //startの日時が重複している要素を1つだけ残して削除する
        var arrObj = {};
        for (var i = 0; i < baseBusyList.length; i++) {
            arrObj[baseBusyList[i]["start"]] = baseBusyList[i];
        }
        var resultList = [];
        for (key in arrObj) {
            resultList.push(arrObj[key]);
        }

        let counter = 0;
        let buffer = [];
        resultList.forEach(busy => {
            if (buffer.length == 0) {
                buffer.push(busy);
                counter = counter + 1;
            } else {
                var milTimeDiff = Math.abs(
                    new moment(busy.start).unix() -
                        new moment(buffer[counter - 1].end).unix()
                );
                if (milTimeDiff < alpha) {
                    //差が1時間（3600000 msec）の場合は結合する
                    buffer[counter - 1].end = busy.end;
                } else {
                    //結合しない場合はそのままbufferにpush
                    buffer.push(busy);
                    counter = counter + 1;
                }
            }
        });
        callback(resultList);
    }

    function responseCommonFreeTime(busyTimeList) {
        console.log(busyTimeList);
        let commonFreeTimeList = [];

        busyTimeList.forEach(function(busyTime, index) {
            if (index == 0) {
            } else {
                console.log();
                console.log(busyTimeList[index - 1]);
                console.log(busyTime);
                console.log(
                    moment(busyTime.start).diff(
                        moment(busyTimeList[index - 1].start),
                        "hour"
                    )
                );
                if (
                    moment(busyTime.start).diff(
                        moment(busyTimeList[index - 1].start),
                        "hour"
                    ) < 12
                ) {
                    let freeTimeJsonObjct = {
                        start: busyTimeList[index - 1].end,
                        end: busyTime.start
                    };
                    commonFreeTimeList.push(freeTimeJsonObjct);
                }
            }
        });
        console.log(commonFreeTimeList);
        if (commonFreeTimeList.length == 0) {
            res.json({
                fulfillmentText:
                    "その期間内で全員の予定が空いている日はありません．"
            });
        } else {
            let freeTimeStart = moment(commonFreeTimeList[0].start).utcOffset(
                "+0900"
            );
            let freeTimeEnd = moment(commonFreeTimeList[0].end).utcOffset(
                "+0900"
            );

            let responseStart = {
                month: freeTimeStart.month() + 1,
                date: freeTimeStart.date(),
                hour: freeTimeStart.hour(),
                minutes: freeTimeStart.minutes()
            };
            let responseEnd = {
                month: freeTimeEnd.month() + 1,
                date: freeTimeEnd.date(),
                hour: freeTimeEnd.hour(),
                minutes: freeTimeEnd.minutes()
            };
            res.json({
                fulfillmentText:
                    responseStart.month +
                    "月" +
                    responseStart.date +
                    "日の" +
                    responseStart.hour +
                    "時" +
                    responseStart.minutes +
                    "分から" +
                    responseEnd.hour +
                    "時" +
                    responseEnd.minutes +
                    "分までであればみなさんの予定が空いています．"
            });
        }
    }
});
module.exports = router;
