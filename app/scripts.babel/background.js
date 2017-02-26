'use strict';

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
  if(message.subject === 'showPageAction'){
    chrome.pageAction.show(sender.tab.id);
  }
});

