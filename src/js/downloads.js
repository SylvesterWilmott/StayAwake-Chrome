'use strict'

/* global chrome */

export function search (state) {
  return new Promise((resolve, reject) => {
    chrome.downloads.search({ state }, function (downloads) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve(downloads)
    })
  })
}
