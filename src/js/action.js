'use strict'

/* global chrome */

export function setIcon (path) {
  return new Promise((resolve, reject) => {
    chrome.action.setIcon(
      {
        path
      },
      function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }
        resolve()
      }
    )
  })
}
