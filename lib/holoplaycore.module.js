var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var cbor = createCommonjsModule(function (module) {
/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Patrick Gansterer <paroga@paroga.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(function(global, undefined$1) {var POW_2_24 = Math.pow(2, -24),
    POW_2_32 = Math.pow(2, 32),
    POW_2_53 = Math.pow(2, 53);

function encode(value) {
  var data = new ArrayBuffer(256);
  var dataView = new DataView(data);
  var lastLength;
  var offset = 0;

  function ensureSpace(length) {
    var newByteLength = data.byteLength;
    var requiredLength = offset + length;
    while (newByteLength < requiredLength)
      newByteLength *= 2;
    if (newByteLength !== data.byteLength) {
      var oldDataView = dataView;
      data = new ArrayBuffer(newByteLength);
      dataView = new DataView(data);
      var uint32count = (offset + 3) >> 2;
      for (var i = 0; i < uint32count; ++i)
        dataView.setUint32(i * 4, oldDataView.getUint32(i * 4));
    }

    lastLength = length;
    return dataView;
  }
  function write() {
    offset += lastLength;
  }
  function writeFloat64(value) {
    write(ensureSpace(8).setFloat64(offset, value));
  }
  function writeUint8(value) {
    write(ensureSpace(1).setUint8(offset, value));
  }
  function writeUint8Array(value) {
    var dataView = ensureSpace(value.length);
    for (var i = 0; i < value.length; ++i)
      dataView.setUint8(offset + i, value[i]);
    write();
  }
  function writeUint16(value) {
    write(ensureSpace(2).setUint16(offset, value));
  }
  function writeUint32(value) {
    write(ensureSpace(4).setUint32(offset, value));
  }
  function writeUint64(value) {
    var low = value % POW_2_32;
    var high = (value - low) / POW_2_32;
    var dataView = ensureSpace(8);
    dataView.setUint32(offset, high);
    dataView.setUint32(offset + 4, low);
    write();
  }
  function writeTypeAndLength(type, length) {
    if (length < 24) {
      writeUint8(type << 5 | length);
    } else if (length < 0x100) {
      writeUint8(type << 5 | 24);
      writeUint8(length);
    } else if (length < 0x10000) {
      writeUint8(type << 5 | 25);
      writeUint16(length);
    } else if (length < 0x100000000) {
      writeUint8(type << 5 | 26);
      writeUint32(length);
    } else {
      writeUint8(type << 5 | 27);
      writeUint64(length);
    }
  }
  
  function encodeItem(value) {
    var i;

    if (value === false)
      return writeUint8(0xf4);
    if (value === true)
      return writeUint8(0xf5);
    if (value === null)
      return writeUint8(0xf6);
    if (value === undefined$1)
      return writeUint8(0xf7);
  
    switch (typeof value) {
      case "number":
        if (Math.floor(value) === value) {
          if (0 <= value && value <= POW_2_53)
            return writeTypeAndLength(0, value);
          if (-POW_2_53 <= value && value < 0)
            return writeTypeAndLength(1, -(value + 1));
        }
        writeUint8(0xfb);
        return writeFloat64(value);

      case "string":
        var utf8data = [];
        for (i = 0; i < value.length; ++i) {
          var charCode = value.charCodeAt(i);
          if (charCode < 0x80) {
            utf8data.push(charCode);
          } else if (charCode < 0x800) {
            utf8data.push(0xc0 | charCode >> 6);
            utf8data.push(0x80 | charCode & 0x3f);
          } else if (charCode < 0xd800) {
            utf8data.push(0xe0 | charCode >> 12);
            utf8data.push(0x80 | (charCode >> 6)  & 0x3f);
            utf8data.push(0x80 | charCode & 0x3f);
          } else {
            charCode = (charCode & 0x3ff) << 10;
            charCode |= value.charCodeAt(++i) & 0x3ff;
            charCode += 0x10000;

            utf8data.push(0xf0 | charCode >> 18);
            utf8data.push(0x80 | (charCode >> 12)  & 0x3f);
            utf8data.push(0x80 | (charCode >> 6)  & 0x3f);
            utf8data.push(0x80 | charCode & 0x3f);
          }
        }

        writeTypeAndLength(3, utf8data.length);
        return writeUint8Array(utf8data);

      default:
        var length;
        if (Array.isArray(value)) {
          length = value.length;
          writeTypeAndLength(4, length);
          for (i = 0; i < length; ++i)
            encodeItem(value[i]);
        } else if (value instanceof Uint8Array) {
          writeTypeAndLength(2, value.length);
          writeUint8Array(value);
        } else {
          var keys = Object.keys(value);
          length = keys.length;
          writeTypeAndLength(5, length);
          for (i = 0; i < length; ++i) {
            var key = keys[i];
            encodeItem(key);
            encodeItem(value[key]);
          }
        }
    }
  }
  
  encodeItem(value);

  if ("slice" in data)
    return data.slice(0, offset);
  
  var ret = new ArrayBuffer(offset);
  var retView = new DataView(ret);
  for (var i = 0; i < offset; ++i)
    retView.setUint8(i, dataView.getUint8(i));
  return ret;
}

function decode(data, tagger, simpleValue) {
  var dataView = new DataView(data);
  var offset = 0;
  
  if (typeof tagger !== "function")
    tagger = function(value) { return value; };
  if (typeof simpleValue !== "function")
    simpleValue = function() { return undefined$1; };

  function read(value, length) {
    offset += length;
    return value;
  }
  function readArrayBuffer(length) {
    return read(new Uint8Array(data, offset, length), length);
  }
  function readFloat16() {
    var tempArrayBuffer = new ArrayBuffer(4);
    var tempDataView = new DataView(tempArrayBuffer);
    var value = readUint16();

    var sign = value & 0x8000;
    var exponent = value & 0x7c00;
    var fraction = value & 0x03ff;
    
    if (exponent === 0x7c00)
      exponent = 0xff << 10;
    else if (exponent !== 0)
      exponent += (127 - 15) << 10;
    else if (fraction !== 0)
      return fraction * POW_2_24;
    
    tempDataView.setUint32(0, sign << 16 | exponent << 13 | fraction << 13);
    return tempDataView.getFloat32(0);
  }
  function readFloat32() {
    return read(dataView.getFloat32(offset), 4);
  }
  function readFloat64() {
    return read(dataView.getFloat64(offset), 8);
  }
  function readUint8() {
    return read(dataView.getUint8(offset), 1);
  }
  function readUint16() {
    return read(dataView.getUint16(offset), 2);
  }
  function readUint32() {
    return read(dataView.getUint32(offset), 4);
  }
  function readUint64() {
    return readUint32() * POW_2_32 + readUint32();
  }
  function readBreak() {
    if (dataView.getUint8(offset) !== 0xff)
      return false;
    offset += 1;
    return true;
  }
  function readLength(additionalInformation) {
    if (additionalInformation < 24)
      return additionalInformation;
    if (additionalInformation === 24)
      return readUint8();
    if (additionalInformation === 25)
      return readUint16();
    if (additionalInformation === 26)
      return readUint32();
    if (additionalInformation === 27)
      return readUint64();
    if (additionalInformation === 31)
      return -1;
    throw "Invalid length encoding";
  }
  function readIndefiniteStringLength(majorType) {
    var initialByte = readUint8();
    if (initialByte === 0xff)
      return -1;
    var length = readLength(initialByte & 0x1f);
    if (length < 0 || (initialByte >> 5) !== majorType)
      throw "Invalid indefinite length element";
    return length;
  }

  function appendUtf16data(utf16data, length) {
    for (var i = 0; i < length; ++i) {
      var value = readUint8();
      if (value & 0x80) {
        if (value < 0xe0) {
          value = (value & 0x1f) <<  6
                | (readUint8() & 0x3f);
          length -= 1;
        } else if (value < 0xf0) {
          value = (value & 0x0f) << 12
                | (readUint8() & 0x3f) << 6
                | (readUint8() & 0x3f);
          length -= 2;
        } else {
          value = (value & 0x0f) << 18
                | (readUint8() & 0x3f) << 12
                | (readUint8() & 0x3f) << 6
                | (readUint8() & 0x3f);
          length -= 3;
        }
      }

      if (value < 0x10000) {
        utf16data.push(value);
      } else {
        value -= 0x10000;
        utf16data.push(0xd800 | (value >> 10));
        utf16data.push(0xdc00 | (value & 0x3ff));
      }
    }
  }

  function decodeItem() {
    var initialByte = readUint8();
    var majorType = initialByte >> 5;
    var additionalInformation = initialByte & 0x1f;
    var i;
    var length;

    if (majorType === 7) {
      switch (additionalInformation) {
        case 25:
          return readFloat16();
        case 26:
          return readFloat32();
        case 27:
          return readFloat64();
      }
    }

    length = readLength(additionalInformation);
    if (length < 0 && (majorType < 2 || 6 < majorType))
      throw "Invalid length";

    switch (majorType) {
      case 0:
        return length;
      case 1:
        return -1 - length;
      case 2:
        if (length < 0) {
          var elements = [];
          var fullArrayLength = 0;
          while ((length = readIndefiniteStringLength(majorType)) >= 0) {
            fullArrayLength += length;
            elements.push(readArrayBuffer(length));
          }
          var fullArray = new Uint8Array(fullArrayLength);
          var fullArrayOffset = 0;
          for (i = 0; i < elements.length; ++i) {
            fullArray.set(elements[i], fullArrayOffset);
            fullArrayOffset += elements[i].length;
          }
          return fullArray;
        }
        return readArrayBuffer(length);
      case 3:
        var utf16data = [];
        if (length < 0) {
          while ((length = readIndefiniteStringLength(majorType)) >= 0)
            appendUtf16data(utf16data, length);
        } else
          appendUtf16data(utf16data, length);
        return String.fromCharCode.apply(null, utf16data);
      case 4:
        var retArray;
        if (length < 0) {
          retArray = [];
          while (!readBreak())
            retArray.push(decodeItem());
        } else {
          retArray = new Array(length);
          for (i = 0; i < length; ++i)
            retArray[i] = decodeItem();
        }
        return retArray;
      case 5:
        var retObject = {};
        for (i = 0; i < length || length < 0 && !readBreak(); ++i) {
          var key = decodeItem();
          retObject[key] = decodeItem();
        }
        return retObject;
      case 6:
        return tagger(decodeItem(), length);
      case 7:
        switch (length) {
          case 20:
            return false;
          case 21:
            return true;
          case 22:
            return null;
          case 23:
            return undefined$1;
          default:
            return simpleValue(length);
        }
    }
  }

  var ret = decodeItem();
  if (offset !== data.byteLength)
    throw "Remaining bytes";
  return ret;
}

var obj = { encode: encode, decode: decode };

if (typeof undefined$1 === "function" && undefined$1.amd)
  undefined$1("cbor/cbor", obj);
else if ( module.exports)
  module.exports = obj;
else if (!global.CBOR)
  global.CBOR = obj;

})(commonjsGlobal);
});

/**
 * This files defines the HoloPlayClient class and Message class.
 *
 * Copyright (c) [2019] [Looking Glass Factory]
 *
 * @link    https://lookingglassfactory.com/
 * @file    This files defines the HoloPlayClient class and Message class.
 * @author  Looking Glass Factory.
 * @version 0.0.8
 * @license SEE LICENSE IN LICENSE.md
 */

// Polyfill WebSocket for nodejs applications.
const WebSocket =
    typeof window === 'undefined' ? require('ws') : window.WebSocket;

/** Class representing a client to communicates with the HoloPlayService. */
class Client {
  /**
   * Establish a client to talk to HoloPlayService.
   * @constructor
   * @param {function} initCallback - optional; a function to trigger when
   *     response is received
   * @param {function} errCallback - optional; a function to trigger when there
   *     is a connection error
   * @param {function} closeCallback - optional; a function to trigger when the
   *     socket is closed
   * @param {boolean} debug - optional; default is false
   * @param {string}  appId - optional
   * @param {boolean} isGreedy - optional
   * @param {string}  oncloseBehavior - optional, can be 'wipe', 'hide', 'none'
   */
  constructor(
      initCallback, errCallback, closeCallback, debug = false, appId, isGreedy,
      oncloseBehavior) {
    this.reqs = [];
    this.reps = [];
    this.requestId = this.getRequestId();
    this.debug = debug;
    this.isGreedy = isGreedy;
    this.errCallback = errCallback;
    this.closeCallback = closeCallback;
    this.alwaysdebug = false;
    this.isConnected = false;
    let initCmd = null;
    if (appId || isGreedy || oncloseBehavior) {
      initCmd = new InitMessage(appId, isGreedy, oncloseBehavior, this.debug);
    } else {
      if (debug) this.alwaysdebug = true;
      if (typeof initCallback == 'function') initCmd = new InfoMessage();
    }
    this.openWebsocket(initCmd, initCallback);
  }
  /**
   * Send a message over the websocket to HoloPlayService.
   * @public
   * @param {Message} msg - message object
   * @param {integer} timeoutSecs - optional, default is 60 seconds
   */
  sendMessage(msg, timeoutSecs = 60) {
    if (this.alwaysdebug) msg.cmd.debug = true;
    let cborData = msg.toCbor();
    return this.sendRequestObj(cborData, timeoutSecs);
  }
  /**
   * Disconnects from the web socket.
   * @public
   */
  disconnect() {
    this.ws.close();
  }
  /**
   * Open a websocket and set handlers
   * @private
   */
  openWebsocket(firstCmd = null, initCallback = null) {
    this.ws =
        new WebSocket('ws://localhost:11222/driver', ['rep.sp.nanomsg.org']);
    this.ws.parent = this;
    this.ws.binaryType = 'arraybuffer';
    this.ws.onmessage = this.messageHandler;
    this.ws.onopen = (() => {
      this.isConnected = true;
      if (this.debug) {
        console.log('socket open');
      }
      if (firstCmd != null) {
        this.sendMessage(firstCmd).then(initCallback);
      }
    });
    this.ws.onerror = this.onSocketError;
    this.ws.onclose = this.onClose;
  }
  /**
   * Send a request object over websocket
   * @private
   */
  sendRequestObj(data, timeoutSecs) {
    return new Promise((resolve, reject) => {
      let reqObj = {
        id: this.requestId++,
        parent: this,
        payload: data,
        success: resolve,
        error: reject,
        send: function() {
          if (this.debug)
            console.log('attemtping to send request with ID ' + this.id);
          this.timeout = setTimeout(reqObj.send.bind(this), timeoutSecs * 1000);
          let tmp = new Uint8Array(data.byteLength + 4);
          let view = new DataView(tmp.buffer);
          view.setUint32(0, this.id);
          tmp.set(new Uint8Array(this.payload), 4);
          this.parent.ws.send(tmp.buffer);
        }
      };
      this.reqs.push(reqObj);
      reqObj.send();
    });
  }
  /**
   * Handles a message when received
   * @private
   */
  messageHandler(event) {
    console.log('message');
    let data = event.data;
    if (data.byteLength < 4) return;
    let view = new DataView(data);
    let replyId = view.getUint32(0);
    if (replyId < 0x80000000) {
      this.parent.err('bad nng header');
      return;
    }
    let i = this.parent.findReqIndex(replyId);
    if (i == -1) {
      this.parent.err('got reply that doesn\'t match known request!');
      return;
    }
    let rep = {id: replyId, payload: cbor.decode(data.slice(4))};
    if (rep.payload.error == 0) {
      this.parent.reqs[i].success(rep.payload);
    } else {
      this.parent.reqs[i].error(rep.payload);
    }
    clearTimeout(this.parent.reqs[i].timeout);
    this.parent.reqs.splice(i, 1);
    this.parent.reps.push(rep);
    if (this.debug) {
      console.log(rep.payload);
    }
  }
  getRequestId() {
    return Math.floor(this.prng() * (0x7fffffff)) + 0x80000000;
  }
  onClose(event) {
    this.parent.isConnected = false;
    if (this.parent.debug) {
      console.log('socket closed');
    }
    if (typeof this.parent.closeCallback == 'function')
      this.parent.closeCallback(event);
  }
  onSocketError(error) {
    if (this.parent.debug) {
      console.log(error);
    }
    if (typeof this.parent.errCallback == 'function') {
      this.parent.errCallback(error);
    }
  }
  err(errorMsg) {
    if (this.debug) {
      console.log('[DRIVER ERROR]' + errorMsg);
    }
    // TODO : make this return an event obj rather than a string
    // if (typeof this.errCallback == 'function')
    //   this.errCallback(errorMsg);
  }
  findReqIndex(replyId) {
    let i = 0;
    for (; i < this.reqs.length; i++) {
      if (this.reqs[i].id == replyId) {
        return i;
      }
    }
    return -1;
  }
  prng() {
    if (this.rng == undefined) {
      this.rng = generateRng();
    }
    return this.rng();
  }
}

/** A class to represent messages being sent over to HoloPlay Service */
class Message {
  /**
   * Construct a barebone message.
   * @constructor
   */
  constructor(cmd, bin) {
    this.cmd = cmd;
    this.bin = bin;
  }
  /**
   * Convert the class instance to the CBOR format
   * @public
   * @returns {CBOR} - cbor object of the message
   */
  toCbor() {
    return cbor.encode(this);
  }
}
/** Message to init. Extends the base Message class. */
class InitMessage extends Message {
  /**
   * @constructor
   * @param {string}  appId - a unique id for app
   * @param {boolean} isGreedy - will it take over screen
   * @param {string}  oncloseBehavior - can be 'wipe', 'hide', 'none'
   */
  constructor(appId = '', isGreedy = false, onclose = '', debug = false) {
    let cmd = {'init': {}};
    if (appId != '') cmd['init'].appid = appId;
    if (onclose != '') cmd['init'].onclose = onclose;
    if (isGreedy) cmd['init'].greedy = true;
    if (debug) cmd['init'].debug = true;
    super(cmd, null);
  }
}
/** Delete a quilt from HoloPlayService. Extends the base Message class. */
class DeleteMessage extends Message {
  /**
   * @constructor
   * @param {string} name - name of the quilt
   */
  constructor(name = '') {
    let cmd = {'delete': {'name': name}};
    super(cmd, null);
  }
}
/** Check if a quilt exist in cache. Extends the base Message class. */
class CheckMessage extends Message {
  /**
   * @constructor
   * @param {string} name - name of the quilt
   */
  constructor(name = '') {
    let cmd = {'check': {'name': name}};
    super(cmd, null);
  }
}
/** Wipes the image in Looking Glass and displays the background image */
class WipeMessage extends Message {
  /**
   * @constructor
   * @param {number} targetDisplay - optional, if not provided, default is 0
   */
  constructor(targetDisplay = null) {
    let cmd = {'wipe': {}};
    if (targetDisplay != null) cmd['wipe'].targetDisplay = targetDisplay;
    super(cmd, null);
  }
}
/** Get info from the HoloPlayService */
class InfoMessage extends Message {
  /**
   * @constructor
   */
  constructor() {
    let cmd = {'info': {}};
    super(cmd, null);
  }
}
/** Get shader uniforms from HoloPlayService */
class UniformsMessage extends Message {
  /**
   * @constructor
   * @param {object}
   */
  constructor() {
    let cmd = {'uniforms': {}};
    super(cmd, bindata);
  }
}
/** Get GLSL shader code from HoloPlayService */
class ShaderMessage extends Message {
  /**
   * @constructor
   * @param {object}
   */
  constructor() {
    let cmd = {'shader': {}};
    super(cmd, bindata);
  }
}
/** Show a quilt in the Looking Glass with the binary data of quilt provided */
class ShowMessage extends Message {
  /**
   * @constructor
   * @param {object}
   */
  constructor(
      settings = {vx: 5, vy: 9, aspect: 1.6}, bindata = '',
      targetDisplay = null) {
    let cmd = {
      'show': {
        'source': 'bindata',
        'quilt': {'type': 'image', 'settings': settings}
      }
    };
    if (targetDisplay != null) cmd['show']['targetDisplay'] = targetDisplay;
    super(cmd, bindata);
  }
}
/** extends the base Message class */
class CacheMessage extends Message {
  constructor(
      name, settings = {vx: 5, vy: 9, aspect: 1.6}, bindata = '',
      show = false) {
    let cmd = {
      'cache': {
        'show': show,
        'quilt': {
          'name': name,
          'type': 'image',
          'settings': settings,
        }
      }
    };
    super(cmd, bindata);
  }
}

class ShowCachedMessage extends Message {
  constructor(name, targetDisplay = null, settings = null) {
    let cmd = {'show': {'source': 'cache', 'quilt': {'name': name}}};
    if (targetDisplay != null) cmd['show']['targetDisplay'] = targetDisplay;
    if (settings != null) cmd['show']['quilt'].settings = settings;
    super(cmd, null);
  }
}
/* helper function */
function generateRng() {
  function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353), h = h << 13 | h >>> 19;
    return function() {
      h = Math.imul(h ^ h >>> 16, 2246822507);
      h = Math.imul(h ^ h >>> 13, 3266489909);
      return (h ^= h >>> 16) >>> 0;
    }
  }
  function xoshiro128ss(a, b, c, d) {
    return (() => {
      var t = b << 9, r = a * 5;
      r = (r << 7 | r >>> 25) * 9;
      c ^= a;
      d ^= b;
      b ^= c;
      a ^= d;
      c ^= t;
      d = d << 11 | d >>> 21;
      return (r >>> 0) / 4294967296;
    })
  }  var state = Date.now();
  var seed = xmur3(state.toString());
  return xoshiro128ss(seed(), seed(), seed(), seed());
}

export { CacheMessage, CheckMessage, Client, DeleteMessage, InfoMessage, InitMessage, Message, ShaderMessage, ShowCachedMessage, ShowMessage, UniformsMessage, WipeMessage };
