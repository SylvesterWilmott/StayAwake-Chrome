'use strict'

/* global chrome, Audio */

chrome.runtime.onMessage.addListener(onMessageReceived)

function onMessageReceived (message, sender, sendResponse) {
  if (message.msg === 'play_sound') {
    playSound(message.sound)
  }

  sendResponse()
}

function playSound (sound) {
  const playable = new Audio(chrome.runtime.getURL(`audio/${sound}.mp3`))
  playable.play()
}
