'use strict'

/* global chrome */

import * as power from './js/power.js'
import * as storage from './js/storage.js'
import * as offscreen from './js/offscreen.js'
import * as message from './js/message.js'
import * as downloads from './js/downloads.js'
import * as action from './js/action.js'

chrome.idle.setDetectionInterval(60)

chrome.idle.onStateChanged.addListener(onIdleStateChanged)
chrome.storage.onChanged.addListener(onStorageChanged)
chrome.runtime.onMessage.addListener(onMessageReceived)
chrome.commands.onCommand.addListener(onCommandReceived)
chrome.permissions.onAdded.addListener(verifyPermissions)
chrome.permissions.onRemoved.addListener(verifyPermissions)

function verifyPermissions () {
  chrome.permissions.contains(
    {
      permissions: ['downloads']
    },
    (result) => {
      if (result) {
        chrome.downloads.onCreated.addListener(onDownloadCreated)
        chrome.downloads.onChanged.addListener(onDownloadsChanged)
      }
    }
  )
}

verifyPermissions()

async function onMessageReceived (message, sender, sendResponse) {
  sendResponse()

  try {
    if (message === 'activate') {
      await toggleOnOff(true)
    } else if (message === 'deactivate') {
      await toggleOnOff(false)
    }
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function onCommandReceived (command) {
  if (command === 'toggleOnOff') {
    const currentStatus = await storage
      .loadSession('status', false)
      .catch((error) => {
        console.error('An error occurred:', error)
      })

    toggleOnOff(!currentStatus)
  }
}

async function toggleOnOff (state) {
  if (state === true) {
    try {
      await turnOn()
    } catch (error) {
      console.error('An error occurred:', error)
    }
  } else if (state === false) {
    try {
      await turnOff()
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }
}

const throttledplaySound = throttle(playSound, 100)

async function turnOn () {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  if (storedPreferences.sounds.status) {
    throttledplaySound('on')
  }

  power.keepAwake(storedPreferences.displaySleep.status ? 'system' : 'display')

  try {
    await Promise.all([updateIcon(true), saveState(true)])
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function turnOff () {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  if (storedPreferences.sounds.status) {
    throttledplaySound('off')
  }

  power.releaseKeepAwake()

  try {
    await Promise.all([
      updateIcon(false),
      saveState(false),
      saveDownloadInProgressFlag(false)
    ])
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function playSound (sound) {
  const documentPath = 'audio-player.html'
  const hasDocument = await offscreen
    .hasDocument(documentPath)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  if (!hasDocument) {
    try {
      await offscreen.create(documentPath)
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }

  try {
    await message.send({ msg: 'play_sound', sound })
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function saveState (state) {
  try {
    await storage.saveSession('status', state)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function saveDownloadInProgressFlag (state) {
  try {
    await storage.saveSession('downloadInProgress', state)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function updateIcon (state) {
  try {
    const path = chrome.runtime.getURL(`images/icon32${state ? '_active' : ''}.png`)
    await action.setIcon(path)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function onIdleStateChanged (state) {
  if (state !== 'locked') return

  const currentStatus = await storage
    .loadSession('status', false)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  if (currentStatus) {
    try {
      await turnOff()
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }
}

async function onDownloadCreated () {
  const allDownloads = await downloads.search('in_progress').catch((error) => {
    console.error('An error occurred:', error)
  })

  const hasInProgressDownloads = allDownloads.some(
    (download) => download.state === 'in_progress'
  )

  if (!hasInProgressDownloads) return

  const currentStatus = await storage
    .loadSession('status', false)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  if (
    hasInProgressDownloads &&
    !currentStatus &&
    storedPreferences?.autoDownloads.status
  ) {
    try {
      await Promise.all([turnOn(), saveDownloadInProgressFlag(true)])
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }
}

async function onDownloadsChanged () {
  const allDownloads = await downloads.search('in_progress').catch((error) => {
    console.error('An error occurred:', error)
  })

  const hasInProgressDownloads = allDownloads.some(
    (download) => download.state === 'in_progress'
  )

  if (hasInProgressDownloads) return

  const currentStatus = await storage
    .loadSession('status', false)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const wasActivatedByDownload = await storage
    .loadSession('downloadInProgress', false)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  if (
    wasActivatedByDownload &&
    !hasInProgressDownloads &&
    currentStatus &&
    storedPreferences.autoDownloads.status
  ) {
    try {
      await turnOff()
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }
}

async function onStorageChanged (changes) {
  if (!changes.preferences) return

  const { oldValue, newValue } = changes.preferences

  if (
    !oldValue ||
    !newValue ||
    oldValue.displaySleep.status === newValue.displaySleep.status
  ) {
    return
  }

  const currentStatus = await storage
    .loadSession('status', false)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  if (currentStatus !== true) return

  power.releaseKeepAwake()
  power.keepAwake(newValue.displaySleep.status ? 'system' : 'display')
}

function throttle (func, delay) {
  let lastExecTime = 0
  return function () {
    const context = this
    const args = arguments
    const now = Date.now()
    if (now - lastExecTime >= delay) {
      lastExecTime = now
      func.apply(context, args)
    }
  }
}
