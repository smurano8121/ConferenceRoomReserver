$(function () {
    $('#signUp').click(
        function () {
            alert("sign up clicked")
            const hostUrl = './registration';
            const $email = $('#email').val();

            let jsonData = {
                "email": $('#email').val(),
                "password": $('#password').val(),
                "name": $('#name').val(),
                "studentNumber": $('#studentNumber').val()
            }

            $.ajax({
                type: 'POST',
                url: hostUrl,
                dataType: 'json',
                data: jsonData,
            }).done(function (data) {
                // alert(data)
                // alert("ok");
                window.location.href = './oauth?email=' + $email; // 通常の遷移
            }).fail(function (XMLHttpRequest, textStatus, errorThrown) {
                alert("textStatus： " + textStatus);
                alert("errorThrown： " + errorThrown);
            });
        });
});