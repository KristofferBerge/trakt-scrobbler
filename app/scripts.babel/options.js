'use strict';

var accessToken = undefined;
var xhr = undefined;
var authxhr = undefined;
var username = undefined;

console.log(document.getElementById('signedIn'));
var notLoggedInSection = document.getElementById('notSignedIn');
document.getElementById('loginButton').addEventListener('click', authenticate);
document.getElementById('signOutButton').addEventListener('click', logOut);


var client_secret = 'bb270b98df702537797ff82e84195915991dab205a9e4ea13470d45c88c7688a';
var client_id = '73fa81f2b8eb248acf687066f0918a999b78e926e501930ab22ad72173978fe9';
//PROD
var chrome_id = 'jddcigfgnkcpfkhccfdaaoaepkmnmmib';

//DEV
//var chrome_id = 'adicolhgphcaaeheekjbmkikgjojdjnm';

function stateChanged(){
    document.getElementById('notSignedIn').style.display = 'none';
    document.getElementById('signedIn').style.display = 'none';    
    //Check if user is logged in
    chrome.storage.sync.get(['traktToken', 'username'], 
        function(items){
            console.log(items);
            if(items['traktToken'] == undefined){
                document.getElementById('notSignedIn').style.display = 'block';
                console.info('User is not logged in');
            }
            else{
                console.info('User is logged in');                
                accessToken = items['traktToken'];
                if(items['username'] == undefined){
                    getUserName();
                    return;
                }
                username = items['username'];
                document.getElementById('userNameSpan').innerHTML = username;
                document.getElementById('signedIn').style.display = 'block';
            }
    });
}

//Trigging stateChanged on init
stateChanged();

function authenticate(){
  chrome.identity.launchWebAuthFlow(
          {
            'url':'https://trakt.tv/oauth/authorize?response_type=code&client_id=73fa81f2b8eb248acf687066f0918a999b78e926e501930ab22ad72173978fe9&redirect_uri=https://' + chrome_id + '.chromiumapp.org/auth', 'interactive': true
          },
          function(redirect_url) {
              //Extracting token from url
              var code = redirect_url.split('code=')[1];
              getAccessToken(code);

          }
    );
}

function logOut(){
    chrome.storage.sync.clear(function(){
        console.log('Chrome storage cleared');
        stateChanged();
    })
}


function getAccessToken(code){
    authxhr = new XMLHttpRequest();
    authxhr.open('POST','https://api.trakt.tv/oauth/token');
    authxhr.onreadystatechange = handleAccessTokenResult;
    authxhr.setRequestHeader('Content-Type', 'application/json');    
    authxhr.send(JSON.stringify({
        'code': code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': 'https://' + chrome_id +'.chromiumapp.org/auth',
        'grant_type': 'authorization_code'
    }));
}

function getUserName(){
    xhr = new XMLHttpRequest();
    xhr.open('GET','https://api.trakt.tv/users/settings');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.setRequestHeader('trakt-api-version', 2);
    xhr.setRequestHeader('trakt-api-key', '73fa81f2b8eb248acf687066f0918a999b78e926e501930ab22ad72173978fe9');
    xhr.onreadystatechange = handleUserNameRequestResult;    
    xhr.send();
}

function handleUserNameRequestResult(){
    if(xhr.readyState == 4){
        if(xhr.status == 200){
            console.log(xhr.responseText);
            var response = JSON.parse(xhr.responseText);
            console.log(response);
            console.log(response.username);
            chrome.storage.sync.set({'username':response.user.username},function(){
                console.log('name saved');
                stateChanged();
            });
        }
        console.log(xhr.responseText);
    }
}

function handleAccessTokenResult(){
    if(authxhr.readyState == 4){
        if(authxhr.status == 200){
            //TODO save refresh token and expiration date
            var token = JSON.parse(authxhr.responseText).access_token;
            chrome.storage.sync.set({'traktToken':token},function(){
                console.log('auth token saved');
            });
            stateChanged();
        }
    }
}