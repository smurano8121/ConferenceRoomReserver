$(function () {
    $('#signUp').click(
        function () {
            const hostUrl = 'http://localhost:3000/registration';
            const $email = $('#email');
            const $password = $('#password');
            const $name = $('#name');
            const $studentNumber = $('#studentNumber');
            $.ajax({
                url: hostUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    email: $email,
                    password: $password,
                    name: $name,
                    studentNumber: $studentNumber
                },
                timeout: 10000,
            }).done(function (data) {
                alert("ok");
            }).fail(function (XMLHttpRequest, textStatus, errorThrown) {
                alert("error");
            })
        });
});