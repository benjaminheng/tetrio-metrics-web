function onDocumentReady(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

class Renderer {
  constructor() {
    // CSV data
    this.gamemode40lData = null;
    this.legacyGamemode40lData = null;

    // Chart data
    this.data40lOverTime = [[], []];
    this.dataPersonalBests = [[], []];
    this.data40lPerformanceDistribution = [[], []];
    this.data40lPercentilesOverGamesPlayed = [[], [], [], []];

    // Other derived data
    this.top10Times = [];

    // Colors
    this.colorPalette = {
      red: "#f2495c",
      blue: "#5794f2",
      teal: "#64b0c8",
      orange: "#e0752d",
      green: "#629e51",
      fontColor: "#ccccdc",
    }

    // Common chart configs
    this.commonConfig = {
      grid: {
        stroke: "#2c3235",
        width: 1 / devicePixelRatio,
      },
      cursor: {
        points: {
          size:   (u, seriesIdx)       => u.series[seriesIdx].points.size * 1.2,
        },
      }
    }

    // Updates the default time format from MM/DD to DD/MM.
    this.timeFormats = [
      // tick incr          default           year                             month    day                        hour     min                sec       mode
      [3600 * 24 * 365,   "{YYYY}",         null,                            null,    null,                      null,    null,              null,        1],
      [3600 * 24 * 28,    "{MMM}",          "\n{YYYY}",                      null,    null,                      null,    null,              null,        1],
      [3600 * 24,         "{D}/{M}",        "\n{YYYY}",                      null,    null,                      null,    null,              null,        1],
      [3600,              "{h}{aa}",        "\n{D}/{M}/{YY}",                null,    "\n{D}/{M}",               null,    null,              null,        1],
      [60,                "{h}:{mm}{aa}",   "\n{D}/{M}/{YY}",                null,    "\n{D}/{M}",               null,    null,              null,        1],
      [1,                 ":{ss}",          "\n{D}/{M}/{YY} {h}:{mm}{aa}",   null,    "\n{D}/{M} {h}:{mm}{aa}",  null,    "\n{h}:{mm}{aa}",  null,        1],
      [0.001,             ":{ss}.{fff}",    "\n{D}/{M}/{YY} {h}:{mm}{aa}",   null,    "\n{D}/{M} {h}:{mm}{aa}",  null,    "\n{h}:{mm}{aa}",  null,        1],
    ];
  }

  async initGamemode40lData() {
    this.gamemode40lData = await this.getGamemode40lData();

    this.compute40lPerformanceOverTimeData();

    // Compute top 10 times
    const sortedGamemode40lData = [...this.gamemode40lData];
    sortedGamemode40lData.sort((a, b) => a.time - b.time);
    this.top10Times = sortedGamemode40lData.slice(0, 10);

    // Compute 40L histogram data
    this.compute40lPerformanceDistributionData(this.gamemode40lData.slice(0, 1000));

    this.compute40lPercentilesOverGamesPlayed();
  }

  compute40lPerformanceOverTimeData() {
    const slidingWindowSize = 20;
    // Data is sorted by played_at descending. Iterate backwards because we
    // want to display the x-axis in ascending order instead.
    for (let i=this.gamemode40lData.length-1; i>=0; i--) {
      const v = this.gamemode40lData[i];
      this.data40lOverTime[0].push(v.played_at);
      this.data40lOverTime[1].push(v.time);
    }
    this.data40lOverTime[1] = this.movingAverage(this.data40lOverTime[1], slidingWindowSize);
  }

  compute40lPerformanceDistributionData(data) {
    if (data.length === 0) {
      return
    }

    data = [...data];
    data.sort((a, b) => a.time - b.time);

    // Initialize buckets
    const min = parseInt(data[0].time);
    let max = parseInt(data[data.length-1].time);
    if (max > 75) {
      max = 75;
    }
    const numBuckets = max-min+1
    const bucketValues = Array.from({length: numBuckets}, () => 0)
    const buckets = Array.from({length: numBuckets}, (_, i) => i+min)

    // Build chart data
    let currentBucket = min;
    for (const v of data) {
      if (v.time > max) {
        // Set upper bound on our histogram
        continue;
      }
      const bucketIndex = parseInt(v.time) - min;
      bucketValues[bucketIndex]++;
    }
    this.data40lPerformanceDistribution = [buckets, bucketValues];
  }

  compute40lPercentilesOverGamesPlayed() {
    const windowSize = 200;
    const win = Array(windowSize).fill(null);
    let windowPointer = 0;

    let numGames = 1;
    for (let i=this.gamemode40lData.length-1; i>=0; i--) {
      const v = this.gamemode40lData[i];
      win[windowPointer] = v.time

      // Move the pointer
      if (windowPointer == windowSize-1) {
        windowPointer = 0;
      } else {
        windowPointer++;
      }

      // Before calculating the percentiles, we first:
      // 1. Verify that window is filled
      // 2. Only calculate percentiles every 10 games, for performance
      if (numGames >= windowSize && numGames % 10 === 0) {
        const sortedWindow = [...win]
        sortedWindow.sort((a, b) => b - a);
        const p50Index = parseInt(sortedWindow.length/2);
        const p95Index = parseInt(sortedWindow.length * 0.95);
        const p90Index = parseInt(sortedWindow.length * 0.90);
        const p50 = sortedWindow[p50Index];
        const p90 = sortedWindow[p90Index];
        const p95 = sortedWindow[p95Index];
        this.data40lPercentilesOverGamesPlayed[0].push(numGames);
        this.data40lPercentilesOverGamesPlayed[1].push(sortedWindow[p50Index]);
        this.data40lPercentilesOverGamesPlayed[2].push(sortedWindow[p90Index]);
        this.data40lPercentilesOverGamesPlayed[3].push(sortedWindow[p95Index]);
      }
      numGames++
    }
  }

  async initLegacyGamemode40lData() {
    this.legacyGamemode40lData = await this.getLegacyGamemode40lData();

    let best = null;

    // Process legacy data, from before we started collecting data using
    // tetrio-metrics.
    if (this.legacyGamemode40lData.length > 0) {
      // Data is sorted by played_at descending. Iterate backwards because we
      // want to display the x-axis in ascending order instead.
      for (let i=this.legacyGamemode40lData.length-1; i>=0; i--) {
        const v = this.legacyGamemode40lData[i];
        this.dataPersonalBests[0].push(v.played_at);
        this.dataPersonalBests[1].push(v.time);
      }
      best = this.legacyGamemode40lData[0].time;
    }

    // Add personal bests from collected data using tetrio-metrics.
    for (let i=this.gamemode40lData.length-1; i>=0; i--) {
      const v = this.gamemode40lData[i];
      if (v.time < best) {
        this.dataPersonalBests[0].push(v.played_at);
        this.dataPersonalBests[1].push(v.time);
        best = v.time
      }
    }
  }

  getLegacyGamemode40lData() {
    return new Promise((resolve) => {
      Papa.parse("https://raw.githubusercontent.com/benjaminheng/tetrio-metrics-archive/master/gamemode_40l_legacy.csv", {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        transformHeader: (header) => {
          if (header === "time_ms") {
            return "time";
          }
          return header;
        },
        transform: (value, header) => {
          if (header === "played_at") {
            return Math.floor(Date.parse(value)/1000);
          } else if (header === "time") {
            return value / 1000; // Transform from milliseconds to seconds
          }
          return value;
        },
      })
    });
  }

  getGamemode40lData() {
    return new Promise((resolve) => {
      Papa.parse("https://raw.githubusercontent.com/benjaminheng/tetrio-metrics-archive/master/gamemode_40l.csv", {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve(results.data);
        },
        transformHeader: (header) => {
          if (header === "time_ms") {
            return "time";
          }
          return header;
        },
        transform: (value, header) => {
          if (header === "played_at") {
            return Math.floor(Date.parse(value)/1000);
          } else if (header === "time") {
            return value / 1000; // Transform from milliseconds to seconds
          }
          return value;
        },
      })
    });
  }

  render40LOverTimeChart() {
    const { spline } = uPlot.paths;
    let opts = {
      id: "chart-40l-over-time",
      width: 800,
      height: 250,
      cursor: this.commonConfig.cursor,
      scales: {
        x: {
          // evenly spaced distribution
          distr: 2,
        },
      },
      axes: [
        {
          stroke: this.colorPalette.fontColor,
          values: this.timeFormats,
          grid: Object.assign(this.commonConfig.grid, {}),
        },
        {
          stroke: this.colorPalette.fontColor,
          values: (u, vals, space) => vals.map(v => this.prettifySeconds(v)),
          grid: Object.assign(this.commonConfig.grid, {}),
        },
      ],
      series: [
        {
          label: "Date",
        },
        {
          show: true,
          label: "Time",
          value: (self, rawValue) => this.prettifySeconds(rawValue),
          stroke: this.colorPalette.green,
          fill: this.colorPalette.green + "1a",
          width: 1,
          drawStyle: null,
          paths: spline(),
        }
      ],
    };

    document.querySelector("div#chart-40l-over-time-container .loading").remove();
    let uplot = new uPlot(opts, this.data40lOverTime, document.getElementById("chart-40l-over-time-container"));
  }

  renderPersonalBestsChart() {
    let opts = {
      id: "40l-personal-bests-chart",
      width: 600,
      height: 250,
      cursor: this.commonConfig.cursor,
      axes: [
        {
          stroke: this.colorPalette.fontColor,
          values: this.timeFormats,
          grid: Object.assign(this.commonConfig.grid, {}),
        },
        {
          stroke: this.colorPalette.fontColor,
          values: (u, vals, space) => vals.map(v => this.prettifySeconds(v)),
          size: 60,
          grid: Object.assign(this.commonConfig.grid, {}),
        },
      ],
      series: [
        {
          label: "Date",
        },
        {
          show: true,
          label: "Time",
          value: (self, rawValue) => this.prettifySeconds(rawValue),
          stroke: this.colorPalette.green,
          fill: this.colorPalette.green + "1a",
          width: 1,
          drawStyle: null,
        }
      ],
    };

    // Remove loading indicator before rendering
    document.querySelector("div#chart-40l-personal-bests-container .loading").remove();
    let uplot = new uPlot(opts, this.dataPersonalBests, document.getElementById("chart-40l-personal-bests-container"));
  }

  render40LPerformanceDistribution() {
    const { bars } = uPlot.paths;
    let opts = {
      id: "40l-performance-distribution-chart",
      width: 800,
      height: 250,
      cursor: this.commonConfig.cursor,
      scales: {
        x: {
          time: false,
          auto: false,
        },
      },
      axes: [
        {
          stroke: this.colorPalette.fontColor,
          values: (u, vals, space) => vals.map(v => v + "s"),
          grid: Object.assign(this.commonConfig.grid, {}),
        },
        {
          stroke: this.colorPalette.fontColor,
          grid: Object.assign(this.commonConfig.grid, {}),
        },
      ],
      series: [
        {
          label: "Time",
          value: (self, rawValue) => rawValue + "s",
        },
        {
          show: true,
          label: "Count",
          points: {
            show: false,
          },
          stroke: this.colorPalette.green,
          fill: this.colorPalette.green + "4c",
          width: 1,
          drawStyle: null,
          paths: bars({
            align: 1,
            size: [1, Infinity],
            gap: 4}
          ),
        }
      ],
    };

    // Remove loading indicator before rendering
    document.querySelector("div#chart-40l-performance-distribution-container .loading").remove();
    let uplot = new uPlot(opts, this.data40lPerformanceDistribution, document.getElementById("chart-40l-performance-distribution-container"));
  }

  render40LPercentilesOverGamesPlayed() {
    const seriesOpts = {
      value: (self, rawValue) => this.prettifySeconds(rawValue),
      width: 1,
      drawStyle: null,
    }
    let opts = {
      id: "chart-40l-percentiles-over-games-played",
      width: 800,
      height: 250,
      cursor: this.commonConfig.cursor,
      scales: {
        x: {
          time: false,
          auto: false,
        },
      },
      axes: [
        {
          stroke: this.colorPalette.fontColor,
          grid: Object.assign(this.commonConfig.grid, {}),
        },
        {
          stroke: this.colorPalette.fontColor,
          values: (u, vals, space) => vals.map(v => this.prettifySeconds(v)),
          grid: Object.assign(this.commonConfig.grid, {}),
        },
      ],
      series: [
        {
          label: "Games played",
          scale: "x",
        },
        Object.assign({
          label: "P50",
          stroke: this.colorPalette.green,
          fill: this.colorPalette.green + "1a",
        }, seriesOpts),
        Object.assign({
          label: "P90",
          stroke: this.colorPalette.blue,
          fill: this.colorPalette.blue + "1a",
        }, seriesOpts),
        Object.assign({
          label: "P95",
          stroke: this.colorPalette.orange,
          fill: this.colorPalette.orange + "1a",
        }, seriesOpts),
      ],
    };

    // Remove loading indicator before rendering
    document.querySelector("div#chart-40l-percentiles-over-games-played-container .loading").remove();
    let uplot = new uPlot(opts, this.data40lPercentilesOverGamesPlayed, document.getElementById("chart-40l-percentiles-over-games-played-container"));
  }

  renderTotalGamesPlayed() {
    document.getElementById("total-games-played").innerHTML = this.gamemode40lData.length;
  }

  renderTop10Table() {
    const tbody = document.querySelector("table#top-10-table tbody")
    let content = "";
    for (const v of this.top10Times) {
      content += `<tr><td>${this.formatDate(v.played_at)}</td><td>${this.prettifySeconds(v.time)}</td></tr>`;
    }
    tbody.innerHTML = content;
  }

  renderRecentGamesTable() {
    const tbody = document.querySelector("table#recent-games-table tbody")
    let content = "";
    for (const v of this.gamemode40lData.slice(0, 5000)) {
      content += `<tr>
        <td>${this.formatDate(v.played_at)}</td>
        <td>${v.time.toFixed(3)}</td>
        <td>${v.finesse_percent.toFixed(2)}%</td>
        <td>${v.total_pieces}</td>
        <td>${v.pieces_per_second.toFixed(2)}</td>
        </tr>`;
    }
    tbody.innerHTML = content;
  }

  prettifySeconds(seconds) {
    if (seconds <= 60) {
      return `${seconds}s`
    }
    const minutes = Math.floor(seconds / 60);
    const remainderSeconds = parseFloat((seconds % 60).toFixed(2));
    return `${minutes}m${remainderSeconds}s`
  }

  formatDate(epochSeconds) {
    const d = new Date(epochSeconds * 1000);
    // date formatting in JS is horrible
    return (
      d.getFullYear()
      + "-"
      + ("0"+(d.getMonth()+1)).slice(-2)
      + "-"
      + ("0" + d.getDate()).slice(-2)
      + " "
      + ("0" + d.getHours()).slice(-2)
      + ":"
      + ("0" + d.getMinutes()).slice(-2)
    );
  }

  addDays(date, days) {
    let newDate = new Date(date.valueOf());
    newDate.setDate(date.getDate() + days);
    return newDate;
  }

  movingAverage(data, windowSize) {
    const rolled = Array(data.length).fill(null);
    let sum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
      const y = data[i];
      if (y == null)
        continue;
      sum += y;
      count++;
      if (i > windowSize - 1) {
        sum -= data[i - windowSize];
        count--;
      }
      rolled[i] = (sum / count).toFixed(2);
    }
    return rolled;
  }
}

async function main() {
  const renderer = new Renderer();
  await renderer.initGamemode40lData().then(() => {
    renderer.render40LOverTimeChart();
    renderer.renderTotalGamesPlayed();
    renderer.renderTop10Table();
    renderer.render40LPerformanceDistribution();
    renderer.render40LPercentilesOverGamesPlayed();
  });
  await renderer.initLegacyGamemode40lData().then(() => {
    renderer.renderPersonalBestsChart();
  });
}

async function recentPage() {
  const renderer = new Renderer();
  await renderer.initGamemode40lData().then(() => {
    renderer.renderRecentGamesTable();
  });
}
