'use strict'

/* global chrome */

import * as i18n from './localize.js'
import * as navigation from './navigation.js'
import * as storage from './storage.js'
import * as message from './message.js'

document.addEventListener('DOMContentLoaded', init)

async function init () {
  try {
    await Promise.all([i18n.localize(), restorePreferences()])
  } catch (error) {
    console.error('An error occurred:', error)
  }

  navigation.init()
  registerListeners()
  ready()
}

async function ready () {
  const animatedElements = document.querySelectorAll('.no-transition')

  for (const el of animatedElements) {
    const pseudoBefore = window.getComputedStyle(el, ':before').content
    const pseudoAfter = window.getComputedStyle(el, ':after').content
    const hasBeforeContent = pseudoBefore !== 'none' && pseudoBefore !== ''
    const hasAfterContent = pseudoAfter !== 'none' && pseudoAfter !== ''

    if (hasBeforeContent || hasAfterContent) {
      el.addEventListener(
        'transitionend',
        function () {
          el.classList.remove('no-transition')
        },
        { once: true }
      )
    }

    el.classList.remove('no-transition')
  }

  const currentState = await storage
    .loadSession('status', false)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  if (currentState === true) {
    const activateElement = document.querySelector('div.label[data-localize="ACTIVATE"]')
    const activateIcon = document.getElementById('icon_toggle')
    activateElement.innerText = chrome.i18n.getMessage('DEACTIVATE')
    activateIcon.classList.add('active')
  }
}

async function restorePreferences () {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  for (const preferenceName in storedPreferences) {
    const preferenceObj = storedPreferences[preferenceName]
    const preferenceElement = document.getElementById(preferenceName)

    if (preferenceElement) {
      preferenceElement.checked = preferenceObj.status
    }
  }
}

function registerListeners () {
  const on = (target, event, handler) => {
    if (typeof target === 'string') {
      document.getElementById(target).addEventListener(event, handler, false)
    } else {
      target.addEventListener(event, handler, false)
    }
  }

  const onAll = (target, event, handler) => {
    const elements = document.querySelectorAll(target)

    for (const el of elements) {
      el.addEventListener(event, handler, false)
    }
  }

  on(document, 'keydown', onDocumentKeydown)
  onAll('input[type="checkbox"]', 'change', onCheckBoxChanged)
  onAll('div.nav-index', 'click', onActionClicked)
}

async function onCheckBoxChanged (e) {
  const target = e.target
  const targetId = target.id

  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
      target.checked = !target.checked
    })

  const preference = storedPreferences[targetId]

  if (!preference) return

  if (preference.permissions !== null) {
    if (preference.permissions.includes('downloads')) {
      if (target.checked) {
        const permissionGranted = await requestDownloadPermission()
          .catch((error) => {
            console.error('An error occurred:', error)
            target.checked = !target.checked
          })

        if (permissionGranted) {
          preference.status = true

          try {
            await storage.save('preferences', storedPreferences)
          } catch (error) {
            console.error('An error occurred:', error)
          }
        } else {
          target.checked = !target.checked
        }
      } else {
        const permissionRemoved = removeDownloadpermission()
          .catch((error) => {
            console.error('An error occurred:', error)
            target.checked = !target.checked
          })

        if (permissionRemoved) {
          preference.status = false

          try {
            await storage.save('preferences', storedPreferences)
          } catch (error) {
            console.error('An error occurred:', error)
          }
        } else {
          target.checked = !target.checked
        }
      }
    }
  } else {
    preference.status = target.checked

    try {
      await storage.save('preferences', storedPreferences)
    } catch (error) {
      console.error('An error occurred:', error)
      target.checked = !target.checked
    }
  }
}

function requestDownloadPermission () {
  return new Promise((resolve, reject) => {
    chrome.permissions.request(
      {
        permissions: ['downloads']
      },
      (granted) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }

        if (granted) {
          resolve(true)
        } else {
          resolve(false)
        }
      }
    )
  })
}

function removeDownloadpermission () {
  return new Promise((resolve, reject) => {
    chrome.permissions.remove(
      {
        permissions: ['downloads']
      },
      (removed) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }

        if (removed) {
          resolve(true)
        } else {
          resolve(false)
        }
      }
    )
  })
}

async function onActionClicked (e) {
  const target = e.target
  const targetId = target.id

  if (targetId === 'action_toggle') {
    const currentState = await storage
      .loadSession('status', false)
      .catch((error) => {
        console.error('An error occurred:', error)
      })

    try {
      if (currentState === false) {
        await message.send('activate')
      } else {
        await message.send('deactivate')
      }

      window.close()
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }
}

function onDocumentKeydown (e) {
  if (e.key === 'o' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
    // This wont fire unless the user has set a custom shortcut
    const toggleEl = document.getElementById('action_toggle')
    toggleEl.click()
  }
}
