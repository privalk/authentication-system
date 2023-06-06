function openTab(event, tabName) {
    var i, tabContent, tabLinks;
    tabContent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabContent.length; i++) {
      tabContent[i].style.display = "none";
    }
    tabLinks = document.getElementsByClassName("tab");
    for (i = 0; i < tabLinks.length; i++) {
      tabLinks[i].className = tabLinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    event.currentTarget.className += " active";
  }
  
  window.onload = function () {
    document.getElementsByClassName("tab")[0].click();
  };
  
const sendCodeButton = document.getElementById('sendCodeButton');


  sendCodeButton.addEventListener('click', () => {
    const email = document.getElementById('emailInput').value;
    const phoneNumber = document.getElementById('phoneNumberInput').value;

    
    const data = {
      email: email,
      phoneNumber: phoneNumber
    };

    // 发送 AJAX 请求
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/send-verification-code');
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          alert(xhr.responseText);
        } else {
          alert('发送验证码失败');
        }
      }
    };

    xhr.send(JSON.stringify(data));
  });