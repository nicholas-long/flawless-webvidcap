
const fs = require("fs")
const puppeteer = require('puppeteer')
const child_process = require('child_process')

// this function is not run here but is passed in to the front end
RECORD_SETTIME = async (time) => {
  for (var v of document.querySelectorAll('video')) {
    // TODO: figure out good logic?
    var t = time;
    while (t > v.duration) t -= v.duration;
    try {
      await v.pause();
      v.currentTime = t;
      await v.play();
      await v.pause();
    } catch (err) { }
    v.currentTime = t;
  }
}

DATEHOOK = function() {
    // Store the original Date class
  const OriginalDate = Date;

  // Global variable to track the elapsed time in seconds
  //let G_TIME = 0;
  G_TIME = 0;

  // Custom Date class
  class FakeDate {
    constructor(...args) {
      if (args.length === 0) {
        // If no arguments are provided, create a date based on G_TIME
        const simulatedTime = new OriginalDate().getTime() + G_TIME * 1000;
        this._date = new OriginalDate(simulatedTime);
      } else {
        // If arguments are provided, delegate to the original Date constructor
        this._date = new OriginalDate(...args);
      }
    }

    // Proxy all Date methods to the internal Date instance
    static get [Symbol.species]() {
      return OriginalDate;
    }

    getTime() {
      return this._date.getTime();
    }

    toISOString() {
      return this._date.toISOString();
    }

    toDateString() {
      return this._date.toDateString();
    }

    toTimeString() {
      return this._date.toTimeString();
    }

    toLocaleString(...args) {
      return this._date.toLocaleString(...args);
    }

    toLocaleDateString(...args) {
      return this._date.toLocaleDateString(...args);
    }

    toLocaleTimeString(...args) {
      return this._date.toLocaleTimeString(...args);
    }

    valueOf() {
      return this._date.valueOf();
    }

    getFullYear() {
      return this._date.getFullYear();
    }

    getMonth() {
      return this._date.getMonth();
    }

    getDate() {
      return this._date.getDate();
    }

    getDay() {
      return this._date.getDay();
    }

    getHours() {
      return this._date.getHours();
    }

    getMinutes() {
      return this._date.getMinutes();
    }

    getSeconds() {
      return this._date.getSeconds();
    }

    getMilliseconds() {
      return this._date.getMilliseconds();
    }

    getTimezoneOffset() {
      return this._date.getTimezoneOffset();
    }

    // Static methods
    static now() {
      return new FakeDate().getTime();
    }

    static parse(...args) {
      return OriginalDate.parse(...args);
    }

    static UTC(...args) {
      return OriginalDate.UTC(...args);
    }

    static [Symbol.hasInstance](instance) {
      return instance instanceof OriginalDate;
    }
  }

  // Replace the global Date class with the custom FakeDate class
  Date = FakeDate;
} // end of date hook (for front end)

const TIMERHOOK = function() {
  class TimerManager {
    constructor() {
      this.timers = [];
      this.currentTime = 0; // Start the current time at 0
    }

    setInterval(callback, interval) {
      const timerId = Symbol();
      this.timers.push({
        id: timerId,
        callback: callback,
        interval: interval / 1000, // Convert interval to seconds
        lastExecuted: this.currentTime,
        type: 'interval',
      });
      return timerId;
    }

    setTimeout(callback, timeout) {
      const timerId = Symbol();
      this.timers.push({
        id: timerId,
        callback: callback,
        timeout: timeout / 1000, // Convert timeout to seconds
        scheduledTime: this.currentTime + timeout / 1000,
        type: 'timeout',
      });
      return timerId;
    }

    clearInterval(timerId) {
      this.timers = this.timers.filter(timer => timer.id !== timerId);
    }

    clearTimeout(timerId) {
      this.clearInterval(timerId); // Same as clearInterval because they share the same structure
    }

    tick(incrementInSeconds) {
      this.currentTime += incrementInSeconds;

      // Sort timers by the order they should be executed
      this.timers.sort((a, b) => {
        if (a.type === 'timeout' && b.type === 'timeout') {
          return a.scheduledTime - b.scheduledTime;
        } else if (a.type === 'interval' && b.type === 'interval') {
          return a.lastExecuted + a.interval - (b.lastExecuted + b.interval);
        } else if (a.type === 'timeout') {
          return a.scheduledTime - (b.lastExecuted + b.interval);
        } else {
          return (a.lastExecuted + a.interval) - b.scheduledTime;
        }
      });

      this.timers.forEach(timer => {
        if (timer.type === 'interval') {
          while (timer.lastExecuted + timer.interval <= this.currentTime) {
            timer.lastExecuted += timer.interval;
            this._executeCallback(timer.callback, timer.lastExecuted);
          }
        } else if (timer.type === 'timeout' && timer.scheduledTime <= this.currentTime) {
          this._executeCallback(timer.callback, timer.scheduledTime);
          this.clearTimeout(timer.id); // Remove timeout after executing
        }
      });
    }

    _executeCallback(callback, executionTime) {
      const previousTime = this.currentTime;
      this.currentTime = executionTime;
      callback();
      this.currentTime = previousTime;
    }
  }

  // Hook for global setTimeout and setInterval
  G_TIMERMANAGER = new TimerManager();
  setInterval = (callback, interval) => G_TIMERMANAGER.setInterval(callback, interval);
  clearInterval = (timerId) => G_TIMERMANAGER.clearInterval(timerId);
  // TODO: temporarily disabled setTimeout hook - it is implemented but it prevents some pages from loading due to timers being used for async delay
  //setTimeout = (callback, timeout) => G_TIMERMANAGER.setTimeout(callback, timeout);
  //clearTimeout = (timerId) => G_TIMERMANAGER.clearTimeout(timerId);

}

async function rec(info) {
  console.log(`about to rec`)

  let browser = null

  try {

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
      'ignoreHTTPSErrors': true
    })

    let page = (await browser.pages())[0]//await browser.newPage()

    await page.setViewport({
      width: info.width,
      height: info.height
    })

    await page.goto(info.url)

    await page.evaluate(`TIMERHOOK = ${TIMERHOOK.toString()}`)
    await page.evaluate(`TIMERHOOK()`) // install timer hooks

    try {
      await page.waitForSelector('[canvascontentloaded]')
    } catch (err) {
      console.log(err)
    }
    console.log('finished waiting for page load')

    //await page.evaluate(`DATEHOOK = ${DATEHOOK.toString()}`)
    //await page.evaluate(`DATEHOOK()`)

    var gifarray = await page.evaluate(() => document.querySelectorAll('img').values().map(i => i.src).filter(i => i.match(/\.gif|\.png$/)).toArray())

    await page.evaluate(() => document.querySelectorAll('img').forEach(i => i.setAttribute('origsrc', i.src))) // set original source property of images so we can find GIFs later
    
    // map gif url -> array of frame data blobs
    var gif_frames = await new Promise((accept) => {
      var p = child_process.exec('./tempimport')
      p.stdin.write(JSON.stringify(gifarray))
      p.stdin.end()
      var data = ""
      p.stdout.on('data', d => {
        data = data + d
      })
      p.on('close', () => accept(require(data.replaceAll("\n", "")))) // use data returned from program as a path for json to import
    });
    console.log("loaded gif map")

    var index = info.offset
    var timestep = 1.0/info.fps
    var time = index * timestep

    console.log(`starting at time ${time}`)
    await page.evaluate(`G_TIMERMANAGER.tick(${time})`) // jump to initial time and execute all timers and intervals

    function delay(time) {
      return new Promise(function (resolve) {
        setTimeout(resolve, time)
      });
    }

    console.log(RECORD_SETTIME.toString())
    await page.evaluate("RECORD_SETTIME = " + RECORD_SETTIME.toString()) // pass in time function to client

    while ((index * timestep) < (info.offset * timestep) + info.duration) {
      // Find all video elements on the page and set them to the time offset
      await page.evaluate(`RECORD_SETTIME(${time})`)
      //await page.evaluate(`G_TIME = ${time}`) // set time for date hooks
      await delay(1)

      // replace all GIFs with data blobs of the frame they should be on
      var gifs = false
      for (var gifurl in gif_frames) {
        var framearr = gif_frames[gifurl]
        if (framearr.length > 1) {
          var frameblob = framearr[Math.round(index / 2) % framearr.length] // divide gif frames by 2 because they're about 30 FPS?
          //console.log(`updating gif ${gifurl} to frame ${index % framearr.length} blobsize ${frameblob.length}`)
          await page.evaluate(`document.querySelectorAll('img[origsrc="${gifurl}"]').forEach(i => i.src="${frameblob}")`)
          gifs = true
        }
      }
      if (gifs) await delay(1)

      // allow selecting just an element from the page
      let screenshotelement = page
      if (info.selector) {
        let matchelement = await page.$(info.selector)
        screenshotelement = matchelement
      }

      let screenshotbuff = await screenshotelement.screenshot({
        omitBackground: true
      })

      const filename = `frame.${index}.png`
      console.log(`writing file ${filename}`)
      fs.writeFileSync(filename, screenshotbuff)

      index++;
      time = timestep * index;
      await page.evaluate(`G_TIMERMANAGER.tick(${timestep})`)
    } // end of time loop

  }
  catch (err) {
    console.log(`❌ Error: ${err.message}`)
    console.log(err)
  }
  finally {
    await browser.close()
  }

} // end of rec function

if (process.argv.length < 9) {
  console.log("missing argument list")
  process.exit(1)
}

const info = {
  url: process.argv[2],
  width: Number(process.argv[3]),
  height: Number(process.argv[4]),
  fps: Number(process.argv[5]),
  duration: Number(process.argv[6]),
  format: process.argv[7],
  offset: Number(process.argv[8]),
}
console.log(info)

rec(info).catch(console.log)
