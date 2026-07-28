/**
 * pageHelpers.js — Guard Hero DevMode Scratchpad page helper utilities.
 * Injected into the page context when execution context is set to "page".
 *
 * Provides the `page` namespace with shorthand utilities for common
 * inspection tasks.
 */

/* eslint-disable no-var */
(function (global) {
  'use strict';

  var page = {};

  /**
   * page.query(selector)
   * Runs document.querySelectorAll and returns a plain array.
   * @param {string} selector - CSS selector
   * @returns {Element[]}
   */
  page.query = function (selector) {
    return Array.from(document.querySelectorAll(selector));
  };

  /**
   * page.fetch(url, opts)
   * fetch() with current page cookies attached.
   * Works in the page context so same-origin cookies are included.
   * @param {string} url
   * @param {RequestInit} [opts]
   * @returns {Promise<Response>}
   */
  page.fetch = function (url, opts) {
    var defaults = { credentials: 'include' };
    return fetch(url, Object.assign({}, defaults, opts));
  };

  /**
   * page.storage()
   * Returns the contents of localStorage and sessionStorage as plain objects.
   * @returns {{ local: Record<string,string>, session: Record<string,string> }}
   */
  page.storage = function () {
    var local = {};
    var session = {};

    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k !== null) local[k] = localStorage.getItem(k);
    }

    for (var j = 0; j < sessionStorage.length; j++) {
      var sk = sessionStorage.key(j);
      if (sk !== null) session[sk] = sessionStorage.getItem(sk);
    }

    return { local: local, session: session };
  };

  /**
   * page.cookies()
   * Parses document.cookie and returns a key-value object.
   * @returns {Record<string, string>}
   */
  page.cookies = function () {
    var result = {};
    var raw = document.cookie;
    if (!raw) return result;

    raw.split(';').forEach(function (pair) {
      var idx = pair.indexOf('=');
      if (idx < 0) return;
      var key = pair.slice(0, idx).trim();
      var val = pair.slice(idx + 1).trim();
      result[key] = decodeURIComponent(val);
    });

    return result;
  };

  /**
   * page.meta()
   * Returns all <meta> tags as a name→content object.
   * @returns {Record<string, string>}
   */
  page.meta = function () {
    var result = {};
    document.querySelectorAll('meta[name], meta[property]').forEach(function (el) {
      var name = el.getAttribute('name') || el.getAttribute('property');
      var content = el.getAttribute('content');
      if (name && content !== null) {
        result[name] = content;
      }
    });
    return result;
  };

  /**
   * page.forms()
   * Returns all forms on the page with their inputs.
   * @returns {Array<{ id: string, action: string, method: string, inputs: Array<{name:string,type:string,value:string}> }>}
   */
  page.forms = function () {
    return Array.from(document.forms).map(function (form) {
      return {
        id: form.id || '',
        action: form.action || '',
        method: form.method || 'get',
        inputs: Array.from(form.elements)
          .filter(function (el) {
            return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
          })
          .map(function (el) {
            return {
              name: el.name || '',
              type: el.type || el.tagName.toLowerCase(),
              value: el.value || '',
            };
          }),
      };
    });
  };

  /**
   * page.links()
   * Returns all <a> tags with their href and text.
   * @returns {Array<{href: string, text: string}>}
   */
  page.links = function () {
    return Array.from(document.querySelectorAll('a[href]')).map(function (a) {
      return { href: a.href, text: a.textContent.trim() };
    });
  };

  /**
   * page.images()
   * Returns all image elements with src and dimensions.
   * @returns {Array<{src: string, alt: string, width: number, height: number}>}
   */
  page.images = function () {
    return Array.from(document.querySelectorAll('img')).map(function (img) {
      return {
        src: img.src,
        alt: img.alt || '',
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    });
  };

  /**
   * page.title()
   * Returns the document title.
   * @returns {string}
   */
  page.title = function () {
    return document.title;
  };

  // Expose on global scope
  global.page = page;

  console.log(
    '%c[Guard Hero Scratchpad]%c page helpers loaded. Try: page.query("a"), page.cookies(), page.storage()',
    'color: #00D4FF; font-weight: bold',
    'color: inherit'
  );
})(typeof globalThis !== 'undefined' ? globalThis : window);
