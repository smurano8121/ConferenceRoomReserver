const { google } = require('googleapis');

exports.insertEvents = function(auth) {
    var calendar = google.calendar('v3');
    var event = {
        'summary': 'APIからの予定登録テスト',
        'start': {
            'dateTime': year+"-"+month+"-"+date+"T"+startHours+":"+startMinutes+":"+startSeconds,
            'timeZone': 'Asia/Tokyo',
        },
        'end': {
            'dateTime': year+"-"+month+"-"+date+"T"+finishHours+":"+finishMinutes+":"+finishSeconds,
            'timeZone': 'Asia/Tokyo',
        },
        'attendees': attendees
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

exports.listEvents = function(auth, startDate, callback) {
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