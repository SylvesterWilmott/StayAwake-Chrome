'use strict'

/* global chrome */

export function keepAwake (state) {
  chrome.power.requestKeepAwake(state)
}

export function releaseKeepAwake () {
  chrome.power.releaseKeepAwake()
}
